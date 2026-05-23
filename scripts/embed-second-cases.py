#!/usr/bin/env python3
"""Parse the refvals output and embed second cases into dist-cases-continuous.js and dist-cases-discrete.js."""

import re
import sys

def parse_refvals_output(filename):
    """Parse the refvals output file into a dict: name -> {params, case_name, vals}"""
    cases = {}
    current_name = None
    current_params = None
    current_case_name = None
    current_vals = []
    is_discrete = False

    with open(filename) as f:
        for line in f:
            line = line.rstrip()
            # Line like: // Alpha  second case: [0.5, 0.5]
            m = re.match(r'^// (\w+)\s+second case: (\[.*\])', line)
            if m:
                # Save previous
                if current_name and current_vals:
                    cases[current_name] = {
                        'params': current_params,
                        'name': current_case_name,
                        'vals': current_vals,
                        'discrete': is_discrete,
                    }
                current_name = m.group(1)
                current_params = m.group(2)
                current_vals = []
                current_case_name = None
                is_discrete = False
                continue
            # Line like: // name: 'shifted location'
            m = re.match(r"^// name: '(.*)'", line)
            if m:
                current_case_name = m.group(1)
                continue
            # Line like:     { x: 1.0, pdf: 0.5, cdf: 0.3 }
            # or:            { x: 1.0, pmf: 0.5, cdf: 0.3 }
            m = re.match(r'^\s+(\{ x: .+ \})', line)
            if m:
                val_str = m.group(1)
                if 'pmf:' in val_str:
                    is_discrete = True
                current_vals.append(val_str)
    # Save last
    if current_name and current_vals:
        cases[current_name] = {
            'params': current_params,
            'name': current_case_name,
            'vals': current_vals,
            'discrete': is_discrete,
        }
    return cases


def format_second_case(case_data):
    """Format a second case as JS code snippet to insert into cases array.

    The returned string starts right after the closing } of the first case
    (which is already in the caller's stripped line prefix), so no leading space.
    """
    lines = []
    lines.append('}, {')
    lines.append(f"    name: '{case_data['name']}',")
    lines.append(f"    params: () => {case_data['params']},")
    lines.append('    refVals: [')
    for val in case_data['vals']:
        lines.append(f'      {val},')
    # Remove trailing comma from last val
    if lines[-1].endswith(','):
        lines[-1] = lines[-1][:-1]
    lines.append('    ]')
    return '\n'.join(lines)


def get_distributions_with_single_case(content):
    """Find distribution names that have exactly 1 case (count of params: () in their cases block)."""
    # We'll parse the file to find distributions and their case counts
    single_case = set()
    # Find each distribution block by finding "name: 'XYZ'" patterns
    # Then find the cases array and count params entries

    # Split by top-level distribution boundaries (}, {\n  name:)
    # This is approximate - use regex to find each distribution entry
    dist_pattern = re.compile(r"  name: '(\w+)'")
    cases_pattern = re.compile(r'  cases: \[')

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        m = dist_pattern.match(lines[i])
        if m:
            dist_name = m.group(1)
            # Look ahead for 'cases: ['
            j = i + 1
            while j < len(lines) and not cases_pattern.match(lines[j]):
                j += 1
            if j < len(lines):
                # Found cases: [ - now find the closing ]
                # Count depth to find the matching ]
                depth = 0
                cases_lines = []
                k = j
                found_open = False
                while k < len(lines):
                    line = lines[k]
                    if not found_open and 'cases: [' in line:
                        found_open = True
                        # Start after the [
                        cases_lines.append(line[line.index('['):])
                        depth = line.count('[') - line.count(']')
                        if depth == 0:
                            break
                        k += 1
                        continue
                    if found_open:
                        cases_lines.append(line)
                        depth += line.count('[') - line.count(']')
                        if depth <= 0:
                            break
                    k += 1

                cases_content = '\n'.join(cases_lines)
                params_count = cases_content.count('params:')
                if params_count == 1:
                    single_case.add(dist_name)
        i += 1
    return single_case


def insert_second_case(content, dist_name, case_data):
    """Insert the second case into the cases array for the given distribution."""
    # Find the distribution entry by name
    # Pattern: name: 'DistName' followed by cases: [{ ... }],
    # We need to find the }] that ends the single case and insert before ]

    lines = content.split('\n')
    result = []
    i = 0

    dist_name_pattern = f"  name: '{dist_name}',"
    found_dist = False
    in_cases = False
    cases_depth = 0
    inserted = False

    while i < len(lines):
        line = lines[i]

        if not found_dist:
            if line.strip() == f"name: '{dist_name}'," or line == f"  name: '{dist_name}',":
                found_dist = True
                result.append(line)
                i += 1
                continue

        if found_dist and not in_cases:
            if '  cases: [' in line:
                in_cases = True
                cases_depth = line.count('[') - line.count(']')
                if cases_depth == 0:
                    # Single-line cases (unlikely but handle it)
                    in_cases = False
                result.append(line)
                i += 1
                continue

        if in_cases and not inserted:
            cases_depth += line.count('[') - line.count(']')

            if cases_depth <= 0:
                # This line closes the cases array
                # The line should be something like:   }],
                # We need to insert the new case before the ]
                # Change }], to }, {\n    ...new case...\n  }],
                new_case_str = format_second_case(case_data)

                # Find the }] in the line and replace with new case + }
                # The line is typically: '  }],' or '  }]'
                stripped = line.rstrip()
                if stripped.endswith('}],'):
                    new_line = stripped[:-3] + new_case_str + '\n  }],'
                    result.append(new_line)
                elif stripped.endswith('}]'):
                    new_line = stripped[:-2] + new_case_str + '\n  }]'
                    result.append(new_line)
                else:
                    # Fallback: just append
                    result.append(line)
                inserted = True
                in_cases = False
                found_dist = False  # Done with this distribution
                i += 1
                continue

        result.append(line)
        i += 1

    if not inserted:
        print(f"WARNING: Could not insert second case for {dist_name}", file=sys.stderr)

    return '\n'.join(result)


def process_file(test_file, cases_data, is_discrete=False):
    """Process a test file and insert second cases."""
    with open(test_file) as f:
        content = f.read()

    # Get distributions with single cases
    single_case_dists = get_distributions_with_single_case(content)
    print(f"Found {len(single_case_dists)} distributions with single case in {test_file}")

    # Filter cases to only relevant distributions
    relevant_cases = {k: v for k, v in cases_data.items()
                      if k in single_case_dists and v['discrete'] == is_discrete}

    not_found = single_case_dists - set(cases_data.keys())
    if not_found:
        print(f"  Distributions with single case but NO refvals: {sorted(not_found)}")

    inserted_count = 0
    modified = content
    for dist_name in sorted(relevant_cases.keys()):
        case_data = relevant_cases[dist_name]
        prev = modified
        modified = insert_second_case(modified, dist_name, case_data)
        if modified != prev:
            inserted_count += 1
        else:
            print(f"  WARNING: No change made for {dist_name}", file=sys.stderr)

    print(f"  Inserted {inserted_count} second cases")

    with open(test_file, 'w') as f:
        f.write(modified)

    return inserted_count


if __name__ == '__main__':
    refvals_file = '/tmp/refvals-output.txt'
    continuous_file = '/home/user/ran/test/dist-cases-continuous.js'
    discrete_file = '/home/user/ran/test/dist-cases-discrete.js'

    print("Parsing refvals output...")
    cases = parse_refvals_output(refvals_file)
    print(f"Parsed {len(cases)} distribution cases")

    # Show some examples
    for name in list(cases.keys())[:3]:
        print(f"  {name}: params={cases[name]['params']}, name='{cases[name]['name']}', "
              f"vals={len(cases[name]['vals'])}, discrete={cases[name]['discrete']}")

    print("\nProcessing continuous distributions...")
    n_cont = process_file(continuous_file, cases, is_discrete=False)

    print("\nProcessing discrete distributions...")
    n_disc = process_file(discrete_file, cases, is_discrete=True)

    print(f"\nDone! Inserted {n_cont} continuous + {n_disc} discrete second cases")

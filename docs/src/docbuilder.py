# title          : docbuilder.py
# description    : Builds a documentation tree from document blocks.
# author         : Enys Mones
# date           : 2017.06.25
# version        : 0.1
# ==================================================================
from syntax import js
from blockparser import BlockParser
import json
import string
import re


class Path:
    """
    Describes a path in the documentation hierarchy.
    """
    def __init__(self, string=""):
        """
        Constructs a Path object.

        :param string: Initial string to use for the path.
        """
        self._path = string

    def __str__(self):
        """
        Casts the Path to a string.

        :return: String representation of the path.
        """
        return self._path

    def root(self):
        """
        Returns the root of the path. The root is the first node in the path.

        :return: The root of the path.
        """
        return self._path.split('.')[0]

    def append(self, node):
        """
        Appends a node to the end of this path.

        :param node: Node to append.
        """
        if self._path == "":
            self._path += node
        else:
            self._path += "." + node

    def truncate(self, path):
        """
        Removes another path from this path.

        :param path: Path to remove.
        """
        return self._path.replace(path._path, "")

    def lowest_common_parent(self, path):
        """
        Returns the lowest common parent node with another path.

        :param path: Other path to calculate lowest parent node with.
        :return: Path to the lowest parent node.
        """
        parent = Path()
        for n1, n2 in zip(self._path.split('.'), path._path.split('.')):
            if n1 == n2:
                parent.append(n1)
            else:
                return parent
        return parent

    def add_leaf(self, tree, leaf):
        """
        Adds a leaf to a tree. If intermediate nodes are missing, they are added to the tree as well with empty node
        key.

        :param tree: Tree to add leaf to.
        :param leaf: Content of the leaf to add.
        """
        node = tree
        for n in self._path.split('.'):
            if n not in node['children']:
                node['children'][n] = {'node': None, 'children': {}}
            node = node['children'][n]
        node['node'] = leaf


class DocBuilder:
    """
    The documentation builder: parses source file and builds source tree.
    """
    def __init__(self):
        self._blocks = []

    @staticmethod
    def _path(block):
        return Path(block.path())

    def parse(self, filename):
        """
        Parses a single file, reading in all available documentation blocks.

        :param filename: Name of the file to document.
        :returns: Reference to the DocBuilder for chaining.
        """
        BlockParser.reset()
        with open(filename, 'r') as f:
            while True:
                block = BlockParser.next_block(filename, f)
                if block is None:
                    break
                else:
                    if block:
                        self._blocks.append(block)
        return self

    def _build(self, converter=None):
        """
        Builds source tree and converts each block calling the specified method if given.

        :param converter: The converted to call for each block.
        :returns: The (converted) documentation tree.
        """
        tree = {'children': {}}
        for block in self._blocks:
            if converter is not None:
                Path(block.path()).add_leaf(tree, converter(block))
            else:
                Path(block.path()).add_leaf(tree, block)
        return tree['children']

    @staticmethod
    def _children(node):
        """
        Returns a sorted list of the children nodes.

        :param node: Node to get children for.
        :return: Children nodes sorted by their source code line.
        """
        return sorted([child for c, child in node['children'].items()],
                      key=lambda x: x['node'].line() if x['node'] is not None else 1, reverse=True)

    def json(self, filename):
        """
        Returns the JSON export of the documentation tree.

        :param filename: Name of the JSON file where the tree should be exported.
        :returns: Reference to the DocBuilder for chaining.
        """
        # Converts block to dictionary
        def to_str(b):
            return b.get()

        # Write JSON
        with open(filename, 'w') as f:
            json.dump(self._build(to_str), f, indent=2)
        return self

    def html(self, name, filename):
        """
        Returns the HTML export of the documentation tree using whiteprint.css.

        :param name: Name of the module.
        :param filename: Name of the HTML file where the tree should be exported.
        :returns: Reference to the DocBuilder for chaining.
        """
        def _codify(text):
            return re.sub(r'\{(.*?)\}', r'<code>\1</code>', text)

        def _linkify(text):
            return re.sub(r'\[(.*)\]\{@link (.*)\}', r'<a href="\2" target="_blank">\1</a>', text)

        def _tagify(text, tag, attr={}):
            ltag = "<" + tag
            for k, v in attr.items():
                ltag += " " + k + "='" + v + "'"
            ltag += ">"
            return ltag + text + "</" + tag + ">"

        def _menu(n):
            """
            Creates the menu.

            :param n: Current node in the documentation tree.
            :return: The menu HTML for the current node.
            """
            b = n['node']

            # Skip private and ignored blocks
            if b is None or b['private'] or b['ignore']:
                return ""

            # If method or variable, just add link
            if b.type() in ['class', 'method', 'var']:
                return "<a href='#api-%s'>%s</a>" % (b.path(), b.id())

            # If class, add third level group
            if b.type() == 'class':
                ret = _tagify('', 'input', {'id': 's3-' + b.path(), 'type': 'checkbox'}) \
                      + _tagify(b.id(), 'label', {'for': 's3-' + b.path()})
                sub = ''.join(_menu(c) for c in reversed(self._children(n)))
                return ret + _tagify(sub, 'div', {'class': 's3'})

            # If namespace, add second level group
            if b.type() == 'namespace':
                ret = _tagify('', 'input', {'id': 's2-' + b.path(), 'type': 'checkbox'})\
                       + _tagify(b.id(), 'label', {'for': 's2-' + b.path()})
                sub = ''.join(_menu(c) for c in reversed(self._children(n)))
                return ret + _tagify(sub, 'div', {'class': 's2'})

            # If module, add first level group
            if b.type() == 'module':
                ret = _tagify('', 'input', {'id': 's1-' + b.path(), 'type': 'checkbox'}) \
                      + _tagify(b.id(), 'label', {'for': 's1-' + b.path()})
                sub = ''.join(_menu(c) for c in reversed(self._children(n)))
                return ret + _tagify(sub, 'div', {'class': 's1'})

        def _method(b):
            """
            Creates the HTML content for a method block.

            :param b: Block to make content for.
            :return: HTML content for the method block.
            """
            name = "<h3 id='api-%s'>%s</h3>\n" % (b.path(), b.id())

            # Build content
            html = ""

            # Code
            code = ""
            params = b['param']
            if len(params) > 0:
                # First parameter
                if 'optional' in params[0]['type']['options']:
                    code += "["
                code += params[0]['name']

                # Remaining parameters
                for p in params[1:]:
                    if 'optional' in p['type']['options']:
                        code += "["
                    code += ", " + p['name']

                # Add closing brackets
                code += ''.join("]" for p in params if 'optional' in p['type']['options'])
            html += _tagify(b.path() + "(" + code + ")", "pre") + "\n"

            # Add description
            html += "<br>" + _codify(_linkify(b['desc'])) + "\n"

            # Add parameter description
            if len(params) > 0:
                argdesc = _tagify(
                    _tagify("<th class='fifth'>arg</th><th class='fifth'>type</th><th>description</th>", "tr"),
                    "thead")
                for p in params:
                    entry = "<td><i>%s</i></td><td>%s</td>"\
                               % (p['name'], ' '.join(_tagify(pt, "code") for pt in p['type']['types']))
                    pdesc = _codify(p['desc'])
                    for opt in ['optional', 'nullable', 'non nullable']:
                        if opt in p['type']['options']:
                            pdesc += " " + _tagify(opt, "code")
                    argdesc += _tagify(entry + _tagify(pdesc, "td"), "tr")
                html += "<br>" + _tagify(argdesc, "table") + "\n"

            # Add return description
            ret = b['returns']
            if len(ret) > 0:
                retdesc = _tagify(
                    _tagify("<th class='fifth'>return</th><th>description</th>", "tr"),
                    "thead") + _tagify("<td><i>%s</i></td><td>%s</td>"
                                       % (' '.join(_tagify(rt, "code") for rt in ret[0]['type']['types']),
                                          ret[0]['desc']), "tr")
                html += _tagify(_codify(retdesc), "table")

            # Add override
            if b['override']:
                html += "<br>" + "Overrides: " + _codify(_linkify(b['override'][0][0]['name']))

            return name + _tagify(html, "div", {'class': 'card'}) + "<br>"

        # Build tree
        tree = self._build()

        # Traverse tree
        menu = ""
        main = ""
        stack = [tree[tree.keys()[0]]]
        while len(stack) > 0:
            # Get next node
            node = stack.pop()

            # If node is not empty, get content
            if node['node'] is not None:
                block = node['node']

                if block['private'] or block['ignore']:
                    continue

                # Build menu
                if block.type() == 'module':
                    menu += _menu(node)

                # Build main content
                t = block.type()
                if t in ['module', 'namespace']:
                    main += "<h2 id='api-%s'>%s</h2>%s\n" % (block.path(), block.path(), block['desc']) + "<br>"
                if t in ['class', 'method']:
                    main += _method(block)

            # Put sorted children in the stack
            stack.extend(self._children(node))

        with open(filename, 'w') as f:
            with open("docs/template.html", 'r') as temp:
                f.write(temp.read()
                        .replace('{{NAME}}', name)
                        .replace('{{NAME_SIMPLIFIED}}', name.replace('-', ''))
                        .replace('{{API_MENU}}', menu)
                        .replace('{{API_CONTENT}}', main))

        return self

DocBuilder = DocBuilder()

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
            return text #re.sub(r'\{(.*?)\}', r'<code>\1</code>', text)

        def _linkify(text):
            return re.sub(r'\[(.*?)\]\{@link (.*?)\}', r'<a href="\2" target="_blank">\1</a>', text)

        def _tagify(text, tag, attr={}):
            ltag = "<" + tag
            for k, v in attr.items():
                ltag += " " + k + "='" + v + "'"
            ltag += ">"
            return ltag + text + ("</" + tag + ">" if text != '' else '')

        def _menu(n):
            """
            Creates the menu.

            :param n: Current node in the documentation tree.
            :return: The menu HTML for the current node.
            """
            b = n['node']

            # Skip private and ignored blocks
            if b is None or b['private'] or b['ignore'] or b['override']:
                return ""

            # If module, add first level group
            if b.type() == 'module':
                return _tagify(
                    ''.join([_menu(c) for c in reversed(self._children(n))]),
                    'ul', {'class': 'sections'}
                )

            # If namespace, add second level group
            if b.type() == 'namespace':
                return _tagify(
                    _tagify(b.id(), 'label', {'id': "toc-" + b.id(), 'for': b.id()})
                    + _tagify('', 'input', {'type': 'checkbox', 'id': b.id()})
                    + _tagify(''.join([_menu(c) for c in reversed(self._children(n))]), 'ul', {'class': 'methods'}),
                    'li'
                )

            if b.type() in ['class']:
                b_id = '.'.join(b.path().split('.')[1:])
                return _tagify(
                    _tagify(b.id(), 'a', {'id': "toc-" + b_id, 'href': '#' + b_id}),
                    'li'
                ) + ''.join([_menu(c) for c in reversed(self._children(n))])

            if b.type() in ['method']:
                b_id = '.'.join(b.path().split('.')[1:])
                return _tagify(
                    _tagify('.'.join(b.path().split('.')[2:]), 'a', {'id': "toc-" + b_id, 'href': '#' + b_id}),
                    'li'
                )

        def _method(b):
            """
            Creates the HTML content for a method block.

            :param b: Block to make content for.
            :return: HTML content for the method block.
            """
            content = ""

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
            content += _tagify('.'.join(b.path().split('.')[1:]) + "(" + code + ")", "pre",
                               {'class': 'title', 'id': '.'.join(b.path().split('.')[1:])})

            # Description
            content += _tagify(_codify(_linkify(b['desc'])), 'div', {'class': 'desc'})

            # Parameters
            if len(params) > 0:
                content += _tagify('Parameters', 'h3')
                argdesc = _tagify(
                    _tagify(
                        _tagify('name', 'th', {'class': 'param-name'})
                        + _tagify('type', 'th', {'class': 'param-type'})
                        + _tagify('description', 'th', {'class': 'param-desc'}),
                        "tr"),
                    "thead")
                rows = ""
                for p in params:
                    entry = "<td><i>%s</i></td><td class='param-type'>%s</td>"\
                               % (p['name'], ' '.join(_tagify(pt.split('.')[-1], "code") for pt in p['type']['types']))
                    desc = p['desc']
                    if 'optional' in p['type']['options']:
                        desc += ' ' + _tagify('optional', 'code')
                    rows += _tagify(entry + _tagify(_codify(desc), "td"), "tr")
                content += _tagify(argdesc + _tagify(rows, 'tbody'), "table")

            # Returns
            ret = b['returns']
            if len(ret) > 0:
                content += _tagify('Returns', 'h3')
                content += _tagify(
                    _tagify(' '.join(_tagify(rt.split('.')[-1], "code") for rt in ret[0]['type']['types']), 'div', {'class': 'return-type'})
                    + _tagify(_codify(ret[0]['desc']), 'div', {'class': 'return-desc'}), 'div', {'class': 'returns'})

            # Example
            examples = b['example']
            if len(examples) > 0:
                content += _tagify('Example', 'h3')
                content += _tagify(_tagify(examples[0]['desc'].strip(), 'code', {'class': 'js example'}), 'pre')

            # Return card
            return _tagify(content, 'div', {'class': 'card'})

        # Build tree
        tree = self._build()

        # Traverse tree
        menu = ""
        main = ""
        search_list = []
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
                if block.type() in ['class', 'method']:
                    search_list.append('.'.join(block.path().split('.')[1:]))
                    main += _method(block)

            # Put sorted children in the stack
            stack.extend(self._children(node))

        # Add search list
        main += _tagify('const SEARCH_LIST = [' + ','.join(["'%s'" % x for x in search_list]) + ']',
                        'script')

        with open(filename, 'w') as f:
            with open("docs/template.html", 'r') as temp:
                f.write(temp.read()
                        .replace('{{NAME}}', name)
                        .replace('{{NAME_SIMPLIFIED}}', name.replace('-', ''))
                        .replace('{{API_MENU}}', menu)
                        .replace('{{API_CONTENT}}', main))

        return self

DocBuilder = DocBuilder()

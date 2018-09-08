# title          : blockparser.py
# description    : Parses a single jsDOC block.
# author         : Enys Mones
# date           : 2017.06.24
# version        : 0.1
# ===============================================
from syntax import js
from lineparser import DocLine
from collections import defaultdict


class DocBlock:
    """
    Class describing a single documentation block.
    """
    def __init__(self, filename, index):
        """
        Constructs an empty DocBlock with an empty description item, and a reference to it.

        :param filename: Name of the current file.
        :param index: Index of the current line where block starts.s
        """
        self._file = filename
        self._index = index
        self._block = defaultdict(list)
        self._block['_file'] = filename
        self._block['_line'] = index
        self._block['desc'] = []
        self._current = self._block['desc']

    def append(self, parsed_line):
        """
        Appends a parsed line to block.

        :param parsed_line: Parsed line to update block with.
        :return: True if parsed line is added or invalid, False if block end is reached.
        """
        # If line is invalid, just return
        if parsed_line is None:
            return True

        # If line is a block end, return block
        if parsed_line['tag'] == "END":
            return False

        # If line is raw description line, append it to current tag
        if parsed_line['tag'] == "none":
            self._current.append(parsed_line)
            return True
        else:
            # Otherwise add tag to block and set current to last tag
            self._block[parsed_line['tag']].append([parsed_line])
            self._current = self._block[parsed_line['tag']][-1]
            return True

    def id(self):
        """
        Returns the identifier of the block.
        The identifier is the name that belongs to a module, namespace, class, method or var tag.

        :return: Identifier of the block.
        """
        for tag in ['module', 'namespace', 'class', 'method', 'var']:
            if tag in self._block:
                return self._block[tag][0][0]['name']
        raise self.MissingIdentifierError(self._index, self._file)

    def type(self):
        """
        Returns the type of the block. Valid types are: module, namespace, class, method and var.

        :return: The type of the block.
        """
        for tag in ['module', 'namespace', 'class', 'method', 'var']:
            if tag in self._block:
                return tag
        raise self.MissingIdentifierError(self._index, self._file)

    def path(self):
        """
        Returns the path to the block in the documentation hierarchy. A path is a sequence of identifiers separated
        by periods.

        :return: Path to the block.
        """
        name = self.id()
        if 'memberOf' in self._block:
            return self._block['memberOf'][0][0]['name'] + "." + name
        elif 'methodOf' in self._block:
            return self._block['methodOf'][0][0]['name'] + "." + name
        else:
            if 'module' in self._block:
                return name
            else:
                raise self.MissingMemberOfError(self._index, self._file)

    def parent(self):
        if 'memberOf' in self._block:
            return self._block['memberOf'][0][0]['name'].split('.')[-1]
        elif 'methodOf' in self._block:
            return self._block['methodOf'][0][0]['name'].split('.')[-1]
        else:
            if 'module' in self._block:
                return None
            else:
                raise self.MissingMemberOfError(self._index, self._file)

    def line(self):
        """
        Returns the line index of the block.

        :return: Line index.
        """
        return self._block['_line']

    def get(self):
        """
        Returns the block content.

        :return: Block content.
        """
        return self._block

    def __getitem__(self, item):
        """
        Item getter for the block. Returns list of items, with concatenated descriptions.

        :param item: Tag to get.
        :return: Block documentation content.
        """
        if item in js.TAGS['flag']:
            return item in self._block

        if item == 'desc':
            return ' '.join(x['desc'] for x in self._block['desc'])

        if item in js.TAGS['value'] or item in js.TAGS['label']:
            return self._block[item]

        if item in js.TAGS['unnamed_value_desc']:
            return [{'type': v[0]['type'],
                    'desc': ' '.join(x['desc'] for x in v)
                     } for v in self._block[item]]

        if item in js.TAGS['named_value_desc']:
            return [{'name': v[0]['name'],
                    'type': v[0]['type'],
                     'desc': ' '.join(x['desc'] for x in v)
                     } for v in self._block[item]]

        if item in js.TAGS['text']:
            return [{'desc': '\n'.join(x['desc'] for x in v if 'desc' in x)}
                    for v in self._block[item]]

        if item not in self._block:
            return None

    """
    Exceptions
    """
    class MissingMemberOfError(Exception):
        """
        Describes a missing memberOf error for block.

        :exception MissingMemberOfError:
        """
        def __init__(self, index, filename):
            Exception.__init__(self, "Missing memberOf for non-module block starting at line %i in file '%s'"
                               % (index, filename))

    class MissingIdentifierError(Exception):
        """
        Describes a missing identifier error for a block.

        :exception MissingIdentifierError:
        """
        def __init__(self, index, filename):
            Exception.__init__(self, "Missing identifier for block starting at line %i in file '%s'"
                               % (index, filename))


class BlockParser:
    """
    Class for parsing and building a documentation block.
    """

    def __init__(self):
        """
        Constructs a new BlockParser object.
        """

        self._block = None
        self._current = None
        self._lineIndex = 0

    def _read_line(self, f):
        """
        Reads in a line and increments index.

        :param f: File reader.
        :return: The line that was read in.
        """

        self._lineIndex += 1
        return f.readline()

    def _read_block(self, filename, f):
        """
        Reads in a complete documentation block.

        :param filename: Name of the current file.
        :param f: File reader.
        :return: The documentation block as a dictionary.
        """

        block = DocBlock(filename, self._lineIndex)
        while True:
            if not block.append(DocLine(filename, self._lineIndex, self._read_line(f)).get()):
                return block

    def reset(self):
        """
        Resets file line index.
        """

        self._lineIndex = 0

    def next_block(self, filename, fp):
        """
        Goes to the next documentation block.
        If EOF found, returns None, otherwise returns True if block is found.

        :param filename: Name of the current file.
        :param fp: File reader.
        :return: True if documentation block was found, False if not, None if EOF was reached.
        """

        while True:
            # Read next line
            line = self._read_line(fp)

            # If EOF, just return None
            if line == "":
                return None

            # Try to parse line
            parsed_line = DocLine(filename, self._lineIndex, line).get()

            # If line is part of documentation, read block and return True
            if parsed_line is not None:
                return self._read_block(filename, fp)
            else:
                return False


BlockParser = BlockParser()

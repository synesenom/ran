# title          : lineparser.py
# description    : Parses a single line for jsDOC.
# author         : Enys Mones
# date           : 2017.06.24
# version        : 0.1
# ==================================================
from syntax import js
import re


class DocLine:
    """
    Describes a single documentation line.
    """

    def __init__(self, filename, index, line):
        """
        Constructs a DocLine with an empty line content.

        :param filename: Name of the current file.
        :param index: Index of the current line.
        """

        self._file = filename
        self._index = index
        self._line = self._parse(line)

    @staticmethod
    def _detect(line):
        """
        Detects category and tag for the current line

        :param line: Line to detect category and tag for.
        :return: Tuple containing the detected category and tag of the line, None otherwise
        """

        # Check if line is block start/end or new tag
        l = re.sub(r'^\* ', '', line.strip())
        for category, keywords in js.TAGS.items():
            for tag, syntax in keywords.items():
                if l.startswith(syntax):
                    return category, tag

        # If not block start/end and new tag, still can be raw description line
        if line.strip().startswith("*"):
            return "line", "none"

        # If none of the above, just return None
        return None, None

    def _extract(self, line, keyword, index=1, remaining=False):
        """
        Extracts the specified tag content from the line.

        :param line: Line to parse.
        :param keyword: Keyword for the current tag.
        :param index: Index of the content to extract after tag.
        :param remaining: Whether to eat up all remaining from the specified index (for descriptions).
        :return: Extracted content.
        :raises: MissingTagContentError.
        """

        # Break line in tokens
        tokens = line.split(' ')

        # Find keyword position
        pos = tokens.index(keyword)

        # Try to extract content
        try:
            if not remaining:
                return tokens[pos+index]
            else:
                return ' '.join(tokens[pos+index:])
        except IndexError:
            raise self.MissingTagContentError(self._file, self._index)

    @staticmethod
    def _parse_type(text):
        """
        Parses a type content.

        :param text: Type content.
        :return: Dictionary describing the type.
        """

        t = text.lstrip('{').rstrip('}')
        options = {}

        # Variable is optional
        if t.endswith('='):
            t = t.rstrip('=')
            options = {'optional': True}

        # Variable is nullable
        elif t.startswith('?'):
            t = t.lstrip('?')
            options = {'nullable': True}

        # Variable is non-nullable
        elif t.startswith('!'):
            t = t.lstrip('!')
            options = {'non nullable': True}

        return {'options': options, 'types': t.lstrip('(').rstrip(')').split('|')}

    def _parse(self, line):
        """
        Parses the documentation line and sets self._line to the parsed content.

        :param line: Line to parse.
        """

        # Clean line
        cleaned_line = re.sub(r'\s+', ' ', line.strip())

        # Detect category and tag
        category, tag = self._detect(cleaned_line)

        # If tag is invalid, just return
        if tag is None:
            return None

        # Otherwise, parse line
        parsed_line = {'tag': tag}

        # Block start/end or flag
        if category in ['block', 'flag']:
            return parsed_line

        # Raw line
        if category == 'line':
            parsed_line['desc'] = cleaned_line.lstrip('* ')
            return parsed_line

        # Label
        kw = js.TAGS[category][tag]
        if category == 'label':
            parsed_line['name'] = self._extract(cleaned_line, kw, 1)
            return parsed_line

        # Description
        if category == 'description':
            parsed_line['desc'] = self._extract(cleaned_line, kw, 1, True)
            return parsed_line

        # Typed value
        if category == 'value':
            parsed_line['type'] = self._parse_type(self._extract(cleaned_line, kw, 1))
            parsed_line['name'] = self._extract(cleaned_line, kw, 2)
            return parsed_line

        # Unnamed value description
        if category == 'unnamed_value_desc':
            parsed_line['type'] = self._parse_type(self._extract(cleaned_line, kw, 1))
            parsed_line['desc'] = self._extract(cleaned_line, kw, 2, True)
            return parsed_line

        # Named value description
        if category == 'named_value_desc':
            parsed_line['type'] = self._parse_type(self._extract(cleaned_line, kw, 1))
            parsed_line['name'] = self._extract(cleaned_line, kw, 2)
            parsed_line['desc'] = self._extract(cleaned_line, kw, 3, True)
            return parsed_line

        return None

    def get(self):
        """
        Returns the parsed line.

        :return: The parsed line
        """

        return self._line

    class MissingTagContentError(Exception):
        """
        Describes a missing tag content error for a tag.
        """

        def __init__(self, filename, index):
            Exception.__init__(self, "Name is missing for at line %i in file '%s'" % (index, filename))

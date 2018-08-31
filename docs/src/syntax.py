# title          : syntax.py
# description    : File containing syntax elements
# author         : Enys Mones
# date           : 2017.06.28
# version        : 0.1
# ==================================================


class _JS:
    def __init__(self):
        pass

    TAGS = {
        'block': {
            'START': "/**",
            'END': "*/",
        },
        'flag': {
            'ignore': "@ignore",
            'private': "@private",
            'constructor': "@constructor",
        },
        'label': {
            'module': "@module",
            'namespace': "@namespace",
            'class': "@class",
            'method': "@method",
            'memberOf': "@memberOf",
            'methodOf': "@methodOf",
            'requires': "@requires",
            'override': "@override",
            'type': "@type"
        },
        'description': {
            'todo': "@todo"
        },
        'value': {
            'var': "@var"
        },
        'unnamed_value_desc': {
            'returns': "@returns"
        },
        'named_value_desc': {
            'param': "@param",
            'property': "@property",
        },
        'text': {
            'example': "@example"
        }
    }

    IDS = ['module', 'namespace', 'class', 'method', 'var']
js = _JS()

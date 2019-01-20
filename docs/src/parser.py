from docbuilder import DocBuilder


### DEBUG ###
#DocBuilder\
#    .parse("src/index.js")\
#    .html("ranjs", "docs/index.html")
(DocBuilder
    .parse_dir("src")
    .html("ranjs", "docs/index.html")
)
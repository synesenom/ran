from docbuilder import DocBuilder


### DEBUG ###
DocBuilder\
    .parse("src/index.js")\
    .html("ranjs", "docs/index.html")

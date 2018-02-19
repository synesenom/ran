from docbuilder import DocBuilder


### DEBUG ###
DocBuilder\
    .parse("src/ran.js")\
    .html("ranjs", "docs/index.html")

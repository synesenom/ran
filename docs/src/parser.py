from docbuilder import DocBuilder


### DEBUG ###
DocBuilder\
    .parse("src/ran.js")\
    .html("docs/index.html")
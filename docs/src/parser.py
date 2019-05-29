from docbuilder import DocBuilder

(DocBuilder
    .parse_dir("src")
    .html("ranjs", "docs/index.html")
)
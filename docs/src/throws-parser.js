module.exports = exception => {
  return {
    type: exception.type.name,
    desc: exception.description.children[0].children[0].value
  }
}

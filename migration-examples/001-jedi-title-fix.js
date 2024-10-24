const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

exports.databaseName = 'StarWars';
exports.containerName = 'jedi';
// NOTE! Create a query with a WHERE clause to limit the items to process!!!
exports.query = 'SELECT * FROM c WHERE c.title = "Master"';
exports.updateItem = function (item) {
  //if possible avoid using if statements here, put the logic in the query!
  item.title = 'Jedi Master';

  // return the updated document! The library will replace the item in the container with this document
  return item;
};

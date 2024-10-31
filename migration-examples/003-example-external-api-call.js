// Set the database and container name for your migration
exports.databaseName = 'StarWars';
exports.containerName = 'jedi';
// NOTE! Create a query with a WHERE clause to limit the items to process!!!
exports.query = 'SELECT * FROM c WHERE c.title = "Jedi Master"';

exports.updateItem = async function (item, axios) {
  // Fetch the last SpaceX launch rocket name from the external API
  const response = await axios.get(
    'https://api.spacexdata.com/v4/launches/latest'
  );
  const travel = response.data.name;

  // Update the item title
  item.lastTravel = `SpaceX Launch: ${travel}`;

  // return the updated document! The library will replace the item in the container with this document
  return item;
};

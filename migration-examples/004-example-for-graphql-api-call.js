exports.databaseName = 'StarWars';
exports.containerName = 'jedi';
// NOTE! Create a query with a WHERE clause to limit the items to process!!!
exports.query = 'SELECT * FROM c WHERE c.name = "Obi-Wan Kenobi"';

exports.updateItem = async function (item, axios) {
  // Fetch the homeworld name from the SWAPI GraphQL API
  const response = await axios.post(
    'https://swapi-graphql.netlify.app/.netlify/functions/index',
    {
      query: `{ allPeople {
          people {
            name
            id
            homeworld {
              name
            }
          }
      }}`,
    }
  );

  // console.dir(response.data, { depth: null });

  // Find the person in the response that matches the item's name
  const person = response.data.data.allPeople.people.find(
    (p) => p.name === item.name
  );

  // Update the item address with the homeworld name if the person is found
  if (person && person.homeworld) {
    item.address = person.homeworld.name;
  }

  // return the updated document! The library will replace the item in the container with this document
  return item;
};

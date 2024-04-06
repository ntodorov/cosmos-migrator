# Introduction

`cosmos-migrator` is a tool that will help you to migrate your CosmosDB databases and Containers.

The philosophy behind this tool is borrowed from [dbup](https://dbup.readthedocs.io/en/latest/philosophy-behind-dbup/) and adjusted to fit the CosmosDB world.
The main takeaway is "Transitions, not States". This means you do not keep versioned schema of your database, but you keep versioned scripts that will transform your database from one state to another.
You also have a Control Table in that database that will keep track of the scripts that were executed, so you can run only the new scripts that you have added.
In the CosmosDB world, the Control Table is a document in the collection called `_migrations`. The document has id = '<the collectionName from the script>' and it has a property 'scripts' that is an array of objects that keep the name of the script and when it was executed.

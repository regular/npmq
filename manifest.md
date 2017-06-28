# npm-graph

npm-graph API, v1.0.0.

Some high-level functions that reveal interesting stuff about npm packages and their authors.

## usage: async

Print usage

```bash
usage [command string]
```

```js
usage(command)
```

 - command: string, the name of a subcommand (optional)

## whois: source

Get the real name of an npm user

```bash
whois {name}
```

```js
whois(name)
```

 - name: the name of an npm account

Returns a stream of possible real names complete with confidence levels between 0 and 1

## whatDoTheyUse: source

Find out what modules are most often depended upon by a group of people.

```bash
whatDoTheyUse {authors array} [--limit number --dev boolean]
```

```js
whatDoTheyUse(authors, { limit:, dev: })
```

 - authros: array, a list of authors. Can be real names or npm user names.
 - opts:
   - limit: optional number, how many items to return
   - dev: include devDependencies (defaults to true(

Finds all direct dependencies of modules published by the given authors and counts how often they are depended upon by this group of authors cumulatively. Sorts by descending popularity.


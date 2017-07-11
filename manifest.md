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

## size: source

Get the size (in bytes) of a package

```bash
size {id}
```

```js
size(id)
```

 - id: the id (name@version) of a package

Returns the size of the package tarball.

## whois: source

Get the real name of an npm user

```bash
whois {name} [--minConfidence number --raw boolean]
```

```js
whois(name, { minConfidence:, raw: })
```

 - name: the name of an npm account or the real name of an author
 - opts:
   - minConfidence: optional, suppress improbable items. (defaults to 0.2) 
   - raw: stream raw views (defaults to false)

Returns a stream of possible author names and/or user names complete with confidence levels between 0 and 1

## repo: source

Find a package by its repository URL.

```bash
repo {urlPrefix}
```

```js
repo(urlPrefix)
```

 - urlPrefix: teh URL prefix to seatch for

Returns a stream of package meta data where the repo URL starts with the given prefix

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
   - dev: include devDependencies (defaults to true)

Finds all direct dependencies of modules published by the given authors and counts how often they are depended upon by this group of authors cumulatively. Sorts by descending popularity.


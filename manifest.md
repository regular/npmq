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

## tags: source

Get all tagged versions of a package

```bash
tags {name}
```

```js
tags(name)
```

 - name: the name of a package.

Returns a stream package objects.

## versions: source

Get all versions of a package

```bash
versions {name}
```

```js
versions(name)
```

 - name: the name of a package.

Returns a stream of version strings.

## deps: source

Get the dependencies of a package

```bash
deps {name_or_id} [--resolve, --dev, --transitive]
```

```js
deps(name_or_id, { resolve:, dev:, transitive: })
```

 - name_or_id: the id (name@version) or name of a package. If no version is given, the latest version will be picked.
 - opts:
   - resolve: whether to resolve to latest matching package. (defaults to false) 
   - dev: include dev dependencies
   - transitive: traverse transitive dependencies (dpes of deps), implies --resolve

Returns a stream of dependencies.

## size: source

Get the size (in bytes) of a package

```bash
size {names_or_ids} [--transitive, --dev]
```

```js
size(names_or_ids, { transitive:, dev: })
```

 - names_or_ids: a list of ids (name@version) or names of packages. If no version is given, the latest version will be picked.

 - opts:
   - transitive: traverse transitive dependencies (dpes of deps) and calculate total size
   - dev: include dev dependencies of top-level packages (requires --transtivie)

Returns the size of a package's tarball or total size of all transtivie dependencies' tarballs.

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


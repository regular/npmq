:hammer: work in progress :hammer:

# npm-graph

## Installation

``` sh
git clone ssb://%FJQrOe3zxWGD+kUtBnNTgFpQYdleHowNXBlw1K80VGo=.sha256 npm-graph
cd npm-graph
npm i
$(npm bin)/npm-to-hypercore .&
node server.js&
./bin.js -h
```

## CLI Examples
```
npm-graph whatDoTheyUse substack domictarr maxogden
npm-graph repo ssb
npm i -g jsonpath-dl
npm-graph repo ssb|jsonpath-dl _id author _npmUser | sort | uniq
npm-graph repo https://github.com/ssbc | jsonpath-dl _id _npmUser.name | sort | uniq
npm i -g list-github-repos
ghorgrepos ssbc | jsonpath-dl git_url ssh_url clone_url > ssbc-repos.txt # gh has an API rate limit
```

## API

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


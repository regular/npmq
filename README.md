:hammer: work in progress :hammer:

# npm-graph

## Installation

``` sh
git clone ssb://%FJQrOe3zxWGD+kUtBnNTgFpQYdleHowNXBlw1K80VGo=.sha256 npm-graph
cd npm-graph
npm i
node server.js&
# in a new terminal:
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

See [manifest.md](manifest.md).

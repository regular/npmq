# npmq

An npm registry follower that stores package mata data in a flumedb and offers a query CLI.

> Note: this requires a lot of bandwidth and disk space (~6GB at the time of writing)

## Installation

``` sh
npm i -q npmq
npmq server path/to/where/you/want/the/db/to/be/created
# in a new terminal:
npmq -h
```

## Some examples
```
npmq whois isaacs
npmq whatDoTheyUse substack domictarr maxogden # most popular packages among a group
npmq repo ssb # all packages with repo URLs starting with "ssb"
npmq size scuttlebot --transitive --dev # size of scuttlebot tarball plus tarball size of all its transitive dependencies including top-level dev dependencies.
```

Output is double-newline-separated JSON.

## API

See [manifest.md](manifest.md).

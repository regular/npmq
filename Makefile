public/bundle.js: client.js manifest.md
	`npm bin`/browserify -t brfs client.js -o $@

clean:
	rm public/bundle.js

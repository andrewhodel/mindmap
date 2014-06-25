##mindmap installation

* generate keys

```
mkdir keys
cd keys
openssl genrsa -out privatekey.pem 1024
openssl req -new -key privatekey.pem -out certrequest.csr
openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
cd ..
```

* install deps

```
sudo apt-get install ffmpeg imagemagick

npm install -g forever

npm install journey mongodb async bcrypt node-static marked multiparty mime imagemagick
```

* edit config.js

* start server

```
forever start mindmap.js
```

* go to https://serveripaddress:8443 (username/password)

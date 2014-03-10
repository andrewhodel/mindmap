##mindmap installation

1. generate keys

```
mkdir keys
openssl genrsa -out privatekey.pem 1024
openssl req -new -key privatekey.pem -out certrequest.csr
openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
```

2. install deps

```
sudo apt-get install avconv imagemagick

npm install journey mongodb async bcrypt node-static marked multiparty mime imagemagick forever
```

3. start server

```
forever start mindmap.js
```

4. go to https://serveripaddress:8443 (username/password)

HUB_URL = $1
ADMIN_PW = $2
# NOTE only for use if this is the only api node
# install mongo
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
# expecting 14.04 ubuntu trusty
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.6 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list
apt-get update
apt-get install -y mongodb-org
# run mongo
sudo service mongod start
# tell hub to set auth_db_url to localhost
curl -X POST "$HUB_URL/post/variable" --data "{admin_password: $ADMIN_PW, variable = 'mongodb://127.0.0.1:27017/'}"
# set up user table with username constaint
mongo dh_auth --eval 'db.createCollection("users")'
mongo dh_auth --eval 'db.users.createIndex( { "username": 1 }, { unique: true } )'

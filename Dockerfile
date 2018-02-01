FROM node:9

WORKDIR "/app"
COPY package*.json ./
COPY . .

RUN apt-get update
RUN apt-get install apt-transport-https
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
RUN echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.6 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-3.6.list

RUN apt-get update
RUN apt-get install curl sudo --yes --force-yes

# build the container

# install dependencies
RUN apt-get --yes --force-yes install npm
RUN apt-get --yes --force-yes install openssl

RUN npm install


RUN apt-get --yes --force-yes install mongodb-org-shell


ENTRYPOINT bash /app/host.sh $hub_url $hub_pw $mongo_host

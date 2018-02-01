FROM node

WORKDIR "/app"
COPY package*.json ./
COPY . .

RUN apt-get update
RUN apt-get install curl sudo --yes --force-yes

# build the container

# install dependencies
RUN apt-get --yes --force-yes install npm
RUN apt-get --yes --force-yes install openssl

RUN npm install

# we need a private key


ENTRYPOINT bash /app/host.sh $hub_url $hub_pw $mongo_host

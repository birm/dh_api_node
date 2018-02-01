# Check if mongo host is set and tell hub, else run local run mongo
RUN [[ -z "$mongo_host" ]] && curl -X POST "$HUB_URL/post/variable" --data "{admin_password: $ADMIN_PW, variable = $mongo_host}" || sudo bash local_run_mongo.sh
# build the container
RUN sudo bash build.sh $hub_url $hub_pw

FROM quay.io/debezium/connect:3.0

# -------------------------------------------------------
# Custom image: Debezium Source + GCS Sink
# Debezium plugin is pre-installed in the base image.
# We add: GCS Sink (Confluent), formerly BigQuery Sink.
# -------------------------------------------------------

USER root

# --- JDBC Sink Connector (for Supabase) --- [DISABLED]
# ENV KAFKA_CONNECT_JDBC_DIR=$KAFKA_CONNECT_PLUGINS_DIR/kafka-connect-jdbc
# RUN mkdir -p $KAFKA_CONNECT_JDBC_DIR && \
#     cd $KAFKA_CONNECT_JDBC_DIR && \
#     curl -sO https://packages.confluent.io/maven/io/confluent/kafka-connect-jdbc/10.7.4/kafka-connect-jdbc-10.7.4.jar && \
#     curl -sO https://jdbc.postgresql.org/download/postgresql-42.7.3.jar

# --- BigQuery Sink Connector (Aiven-Open fork, v2.12.0) --- [DISABLED]
# ENV KAFKA_CONNECT_BQ_DIR=$KAFKA_CONNECT_PLUGINS_DIR/bigquery-connector
# RUN mkdir -p $KAFKA_CONNECT_BQ_DIR && \
#     cd /tmp && \
#     curl -fL -o bigquery-connector.tar https://github.com/Aiven-Open/bigquery-connector-for-apache-kafka/releases/download/v2.12.0/bigquery-connector-for-apache-kafka-2.12.0.tar && \
#     tar -xf bigquery-connector.tar -C $KAFKA_CONNECT_BQ_DIR && \
#     rm -f bigquery-connector.tar

# --- AWS S3 Sink Connector (Aiven-Open, v2.15.0) --- [ACTIVE]
# Apache-licensed, vendor-neutral. Compatible with Apache Kafka 3.x.
# Replaces Confluent S3 which requires Confluent's Kafka fork (NoSuchMethodError on Utils.join()).
ENV KAFKA_CONNECT_S3_DIR=$KAFKA_CONNECT_PLUGINS_DIR/aiven-kafka-connect-s3
RUN mkdir -p $KAFKA_CONNECT_S3_DIR && \
    cd /tmp && \
    curl -fL -o s3-connector.tar \
      https://github.com/Aiven-Open/s3-connector-for-apache-kafka/releases/download/v2.15.0/s3-connector-for-apache-kafka-2.15.0.tar && \
    tar -xf s3-connector.tar -C $KAFKA_CONNECT_S3_DIR && \
    rm -f s3-connector.tar

# # --- GCS Sink Connector (Aiven-Open, v0.13.0) --- [ACTIVE]
# # Open-source connector, compatible with Debezium/Apache Kafka Connect base image.
# # Same vendor (Aiven) as the BigQuery connector that was previously used.
# ENV KAFKA_CONNECT_GCS_DIR=$KAFKA_CONNECT_PLUGINS_DIR/aiven-kafka-connect-gcs
# RUN mkdir -p $KAFKA_CONNECT_GCS_DIR && \
#     cd /tmp && \
#     curl -fL -o gcs-connector.tar \
#       https://github.com/Aiven-Open/gcs-connector-for-apache-kafka/releases/download/v0.13.0/gcs-connector-for-apache-kafka-0.13.0.tar && \
#     tar -xf gcs-connector.tar -C $KAFKA_CONNECT_GCS_DIR && \
#     rm -f gcs-connector.tar

USER kafka

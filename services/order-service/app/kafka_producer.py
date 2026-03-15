import json
import logging
import os
from datetime import datetime

logger = logging.getLogger("order-service.kafka")

TOPIC_ORDERS = "orders"
_producer = None


def _bootstrap_servers() -> str:
    return os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092").strip()


def _build_producer():
    from kafka import KafkaProducer  # noqa: PLC0415

    return KafkaProducer(
        bootstrap_servers=_bootstrap_servers(),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
        acks=1,
        retries=3,
        request_timeout_ms=5000,
        api_version_auto_timeout_ms=5000,
    )


def get_producer():
    global _producer
    if _producer is None:
        try:
            _producer = _build_producer()
        except Exception as exc:
            logger.warning("Kafka producer init failed: %s", exc)
    return _producer


def _publish(event_type: str, payload: dict) -> None:
    """Fire-and-forget — never raises; Kafka unavailability must not fail HTTP requests."""
    try:
        producer = get_producer()
        if producer is None:
            print(f"[order-service] Kafka producer unavailable, skipping {event_type}")
            return
        payload["event"] = event_type
        payload["timestamp"] = datetime.utcnow().isoformat()
        future = producer.send(
            TOPIC_ORDERS,
            key=str(payload.get("order_id", "")),
            value=payload,
        )
        producer.flush(timeout=3)
        future.get(timeout=3)
        print(f"[order-service] Kafka published {event_type} order_id={payload.get('order_id')}")
        logger.info("Kafka published %s order_id=%s", event_type, payload.get("order_id"))
    except Exception as exc:
        print(f"[order-service] Kafka publish failed ({event_type}): {exc}")
        logger.warning("Kafka publish skipped (%s): %s", event_type, exc)


def publish_order_created(order) -> None:
    _publish(
        "order.created",
        {
            "order_id": order.order_id,
            "buyer_id": order.buyer_id,
            "total_amount": str(order.total_amount),
            "status": order.status.value if hasattr(order.status, "value") else str(order.status),
            "shipping_address": order.shipping_address,
            "items": [
                {
                    "book_id": item.book_id,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                }
                for item in order.items
            ],
        },
    )


def publish_order_shipped(order) -> None:
    _publish(
        "order.shipped",
        {
            "order_id": order.order_id,
            "buyer_id": order.buyer_id,
            "total_amount": str(order.total_amount),
            "status": order.status.value if hasattr(order.status, "value") else str(order.status),
            "shipping_address": order.shipping_address,
        },
    )


def publish_order_delivered(order) -> None:
    _publish(
        "order.delivered",
        {
            "order_id": order.order_id,
            "buyer_id": order.buyer_id,
            "total_amount": str(order.total_amount),
            "status": "delivered",
            "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
            "shipping_address": order.shipping_address,
        },
    )


def init_kafka_topic() -> None:
    """Create the 'orders' topic if it doesn't exist. Retries up to 5 times with 3s delay."""
    import time
    from kafka.admin import KafkaAdminClient, NewTopic  # noqa: PLC0415
    from kafka.errors import TopicAlreadyExistsError  # noqa: PLC0415

    servers = _bootstrap_servers()
    for attempt in range(1, 6):
        try:
            admin = KafkaAdminClient(
                bootstrap_servers=servers,
                client_id="order-service-admin",
                request_timeout_ms=5000,
                api_version_auto_timeout_ms=5000,
            )
            admin.create_topics(
                [NewTopic(name=TOPIC_ORDERS, num_partitions=3, replication_factor=1)]
            )
            admin.close()
            logger.info("Kafka topic '%s' created.", TOPIC_ORDERS)
            print(f"[order-service] Kafka topic '{TOPIC_ORDERS}' created.")
            return
        except TopicAlreadyExistsError:
            logger.info("Kafka topic '%s' already exists.", TOPIC_ORDERS)
            print(f"[order-service] Kafka topic '{TOPIC_ORDERS}' already exists.")
            return
        except Exception as exc:
            print(f"[order-service] Kafka topic init attempt {attempt}/5 failed: {exc}")
            if attempt < 5:
                time.sleep(3)
    print(f"[order-service] Kafka topic init failed — service continues without Kafka.")

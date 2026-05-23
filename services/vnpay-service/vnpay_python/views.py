import hashlib
import hmac
import json
import logging
import urllib
import urllib.parse
import urllib.request
import random
import requests
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import uuid4
from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render, redirect
from django.utils.http import urlquote
from django.views.decorators.csrf import csrf_exempt

from vnpay_python.forms import PaymentForm
from vnpay_python.vnpay import vnpay


logger = logging.getLogger("vnpay-service.ipn")


def normalize_vnd_amount(amount):
    value = Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(value)


def build_txn_ref(order_id):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3]
    suffix = uuid4().hex[:8]
    return f'{order_id}-{timestamp}-{suffix}'


def parse_order_id_from_txn_ref(txn_ref):
    order_id_raw = str(txn_ref or '').split('-', 1)[0]
    return int(order_id_raw)


def index(request):
    return render(request, "index.html", {"title": "Danh sách demo"})


@csrf_exempt
def create_payment_url(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid JSON payload'}, status=400)

    order_id = str(payload.get('order_id') or '').strip()
    amount = payload.get('amount')
    order_desc = str(payload.get('order_desc') or f'Thanh toan don hang {order_id}').strip()
    bank_code = str(payload.get('bank_code') or '').strip()
    language = str(payload.get('language') or 'vn').strip()
    return_url = str(payload.get('return_url') or settings.VNPAY_RETURN_URL or '').strip()

    if not order_id:
        return JsonResponse({'detail': 'order_id is required'}, status=400)

    if amount is None:
        return JsonResponse({'detail': 'amount is required'}, status=400)

    try:
        amount_value = normalize_vnd_amount(amount)
    except (InvalidOperation, TypeError, ValueError):
        return JsonResponse({'detail': 'amount must be a valid number'}, status=400)

    if amount_value <= 0:
        return JsonResponse({'detail': 'amount must be greater than 0'}, status=400)

    if not return_url:
        return JsonResponse({'detail': 'return_url is required'}, status=400)

    if not settings.VNPAY_PAYMENT_URL or not settings.VNPAY_HASH_SECRET_KEY or not settings.VNPAY_TMN_CODE:
        return JsonResponse({'detail': 'VNPay configuration is missing'}, status=500)

    request_id = uuid4().hex[:12]
    txn_ref = build_txn_ref(order_id)

    logger.info(
        "create_payment_url.request request_id=%s order_id=%s txn_ref=%s amount_vnd=%s return_url=%s ipn_url=%s bank_code=%s client_ip=%s",
        request_id,
        order_id,
        txn_ref,
        amount_value,
        return_url,
        settings.VNPAY_IPN_URL or "-",
        bank_code or "-",
        request.META.get('REMOTE_ADDR', 'unknown'),
    )

    vnp = vnpay()
    vnp.requestData['vnp_Version'] = '2.1.0'
    vnp.requestData['vnp_Command'] = 'pay'
    vnp.requestData['vnp_TmnCode'] = settings.VNPAY_TMN_CODE
    vnp.requestData['vnp_Amount'] = amount_value * 100
    vnp.requestData['vnp_CurrCode'] = 'VND'
    vnp.requestData['vnp_TxnRef'] = txn_ref
    vnp.requestData['vnp_OrderInfo'] = order_desc
    vnp.requestData['vnp_OrderType'] = 'other'
    vnp.requestData['vnp_Locale'] = language if language else 'vn'
    if bank_code:
        vnp.requestData['vnp_BankCode'] = bank_code
    vnp.requestData['vnp_CreateDate'] = datetime.now().strftime('%Y%m%d%H%M%S')
    vnp.requestData['vnp_IpAddr'] = request.META.get('REMOTE_ADDR', '127.0.0.1')
    vnp.requestData['vnp_ReturnUrl'] = return_url

    payment_url = vnp.get_payment_url(settings.VNPAY_PAYMENT_URL, settings.VNPAY_HASH_SECRET_KEY)
    parsed_payment_url = urllib.parse.urlparse(payment_url)
    logger.info(
        "create_payment_url.success request_id=%s order_id=%s txn_ref=%s amount_vnd=%s vnp_amount=%s payment_host=%s create_date=%s",
        request_id,
        order_id,
        txn_ref,
        amount_value,
        vnp.requestData['vnp_Amount'],
        parsed_payment_url.netloc,
        vnp.requestData['vnp_CreateDate'],
    )
    return JsonResponse({'payment_url': payment_url})


def hmacsha512(key, data):
    byteKey = key.encode('utf-8')
    byteData = data.encode('utf-8')
    return hmac.new(byteKey, byteData, hashlib.sha512).hexdigest()


def payment(request):

    if request.method == 'POST':
        # Process input data and build url payment
        form = PaymentForm(request.POST)
        if form.is_valid():
            order_type = form.cleaned_data['order_type']
            order_id = form.cleaned_data['order_id']
            amount = form.cleaned_data['amount']
            order_desc = form.cleaned_data['order_desc']
            bank_code = form.cleaned_data['bank_code']
            language = form.cleaned_data['language']
            ipaddr = get_client_ip(request)
            # Build URL Payment
            vnp = vnpay()
            vnp.requestData['vnp_Version'] = '2.1.0'
            vnp.requestData['vnp_Command'] = 'pay'
            vnp.requestData['vnp_TmnCode'] = settings.VNPAY_TMN_CODE
            vnp.requestData['vnp_Amount'] = amount * 100
            vnp.requestData['vnp_CurrCode'] = 'VND'
            vnp.requestData['vnp_TxnRef'] = order_id
            vnp.requestData['vnp_OrderInfo'] = order_desc
            vnp.requestData['vnp_OrderType'] = order_type
            # Check language, default: vn
            if language and language != '':
                vnp.requestData['vnp_Locale'] = language
            else:
                vnp.requestData['vnp_Locale'] = 'vn'
                # Check bank_code, if bank_code is empty, customer will be selected bank on VNPAY
            if bank_code and bank_code != "":
                vnp.requestData['vnp_BankCode'] = bank_code

            vnp.requestData['vnp_CreateDate'] = datetime.now().strftime('%Y%m%d%H%M%S')  # 20150410063022
            vnp.requestData['vnp_IpAddr'] = ipaddr
            vnp.requestData['vnp_ReturnUrl'] = settings.VNPAY_RETURN_URL
            vnpay_payment_url = vnp.get_payment_url(settings.VNPAY_PAYMENT_URL, settings.VNPAY_HASH_SECRET_KEY)
            print(vnpay_payment_url)
            return redirect(vnpay_payment_url)
        else:
            print("Form input not validate")
    else:
        return render(request, "payment.html", {"title": "Thanh toán"})


def payment_ipn(request):
    inputData = request.GET
    if not inputData:
        logger.warning("ipn.invalid_request empty_query")
        return JsonResponse({'RspCode': '99', 'Message': 'Invalid request'})

    vnp = vnpay()
    vnp.responseData = inputData.dict()

    logger.info(
        "ipn.received txn_ref=%s response_code=%s txn_status=%s txn_no=%s tmn_code=%s",
        inputData.get('vnp_TxnRef', ''),
        inputData.get('vnp_ResponseCode', ''),
        inputData.get('vnp_TransactionStatus', ''),
        inputData.get('vnp_TransactionNo', ''),
        inputData.get('vnp_TmnCode', ''),
    )

    if not vnp.validate_response(settings.VNPAY_HASH_SECRET_KEY):
        logger.warning("ipn.invalid_signature txn_ref=%s", inputData.get('vnp_TxnRef', ''))
        return JsonResponse({'RspCode': '97', 'Message': 'Invalid Signature'})

    vnp_ResponseCode = inputData.get('vnp_ResponseCode', '')
    vnp_TransactionStatus = inputData.get('vnp_TransactionStatus', '')
    txn_ref = inputData.get('vnp_TxnRef', '')
    amount_raw = inputData.get('vnp_Amount', '')
    vnp_TransactionNo = inputData.get('vnp_TransactionNo', '')
    vnp_TmnCode = inputData.get('vnp_TmnCode', '')

    if vnp_TmnCode != settings.VNPAY_TMN_CODE:
        logger.warning("ipn.invalid_tmn txn_ref=%s got=%s", txn_ref, vnp_TmnCode)
        return JsonResponse({'RspCode': '99', 'Message': 'Invalid TmnCode'})

    # Failed or cancelled transactions should be acknowledged so VNPay stops retrying.
    if vnp_ResponseCode != '00' or vnp_TransactionStatus != '00':
        logger.info(
            "ipn.non_success_ack txn_ref=%s response_code=%s txn_status=%s",
            txn_ref,
            vnp_ResponseCode,
            vnp_TransactionStatus,
        )
        return JsonResponse({'RspCode': '00', 'Message': 'Confirm Success'})

    try:
        order_id = parse_order_id_from_txn_ref(txn_ref)
    except (ValueError, TypeError):
        logger.warning("ipn.invalid_order_id txn_ref=%s", txn_ref)
        return JsonResponse({'RspCode': '01', 'Message': 'Order not found'})

    try:
        amount = int(amount_raw)
    except (ValueError, TypeError):
        logger.warning("ipn.invalid_amount order_id=%s txn_ref=%s raw=%s", order_id, txn_ref, amount_raw)
        return JsonResponse({'RspCode': '04', 'Message': 'Invalid amount'})

    internal_secret = settings.INTERNAL_SERVICE_SECRET
    if not internal_secret:
        logger.error("ipn.misconfigured missing_internal_secret order_id=%s txn_ref=%s", order_id, txn_ref)
        return JsonResponse({'RspCode': '99', 'Message': 'Service misconfigured'})

    try:
        logger.info(
            "ipn.forward_to_payment_service order_id=%s txn_ref=%s amount=%s transaction_code=%s",
            order_id,
            txn_ref,
            amount,
            vnp_TransactionNo,
        )
        resp = requests.post(
            f'{settings.PAYMENT_SERVICE_URL}/payments/internal/vnpay-confirm',
            json={
                'order_id': order_id,
                'amount': amount,
                'transaction_code': vnp_TransactionNo,
            },
            headers={'X-Internal-Secret': internal_secret},
            timeout=5,
        )
        logger.info(
            "ipn.payment_service_response order_id=%s txn_ref=%s status_code=%s",
            order_id,
            txn_ref,
            resp.status_code,
        )
        if resp.status_code in (200, 201):
            return JsonResponse({'RspCode': '00', 'Message': 'Confirm Success'})
        if resp.status_code == 404:
            return JsonResponse({'RspCode': '01', 'Message': 'Order not found'})
        if resp.status_code == 409:
            return JsonResponse({'RspCode': '02', 'Message': 'Order already updated'})
        if resp.status_code == 422:
            return JsonResponse({'RspCode': '04', 'Message': 'Invalid amount'})
        logger.warning(
            "ipn.payment_service_unexpected_status order_id=%s txn_ref=%s status_code=%s body=%s",
            order_id,
            txn_ref,
            resp.status_code,
            (resp.text or '')[:300],
        )
        return JsonResponse({'RspCode': '02', 'Message': 'Payment service error'})
    except requests.RequestException:
        logger.exception("ipn.payment_service_request_error order_id=%s txn_ref=%s", order_id, txn_ref)
        return JsonResponse({'RspCode': '99', 'Message': 'Internal error'})
    except Exception:
        logger.exception("ipn.unexpected_error order_id=%s txn_ref=%s", order_id, txn_ref)
        return JsonResponse({'RspCode': '99', 'Message': 'Internal error'})


def payment_return(request):
    inputData = request.GET
    if inputData:
        vnp = vnpay()
        vnp.responseData = inputData.dict()
        order_id = inputData['vnp_TxnRef']
        amount = int(inputData['vnp_Amount']) / 100
        order_desc = inputData['vnp_OrderInfo']
        vnp_TransactionNo = inputData['vnp_TransactionNo']
        vnp_ResponseCode = inputData['vnp_ResponseCode']
        vnp_TmnCode = inputData['vnp_TmnCode']
        vnp_PayDate = inputData['vnp_PayDate']
        vnp_BankCode = inputData['vnp_BankCode']
        vnp_CardType = inputData['vnp_CardType']
        if vnp.validate_response(settings.VNPAY_HASH_SECRET_KEY):
            if vnp_ResponseCode == "00":
                return render(request, "payment_return.html", {"title": "Kết quả thanh toán",
                                                               "result": "Thành công", "order_id": order_id,
                                                               "amount": amount,
                                                               "order_desc": order_desc,
                                                               "vnp_TransactionNo": vnp_TransactionNo,
                                                               "vnp_ResponseCode": vnp_ResponseCode})
            else:
                return render(request, "payment_return.html", {"title": "Kết quả thanh toán",
                                                               "result": "Lỗi", "order_id": order_id,
                                                               "amount": amount,
                                                               "order_desc": order_desc,
                                                               "vnp_TransactionNo": vnp_TransactionNo,
                                                               "vnp_ResponseCode": vnp_ResponseCode})
        else:
            return render(request, "payment_return.html",
                          {"title": "Kết quả thanh toán", "result": "Lỗi", "order_id": order_id, "amount": amount,
                           "order_desc": order_desc, "vnp_TransactionNo": vnp_TransactionNo,
                           "vnp_ResponseCode": vnp_ResponseCode, "msg": "Sai checksum"})
    else:
        return render(request, "payment_return.html", {"title": "Kết quả thanh toán", "result": ""})


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

n = random.randint(10**11, 10**12 - 1)
n_str = str(n)
while len(n_str) < 12:
    n_str = '0' + n_str


def query(request):
    if request.method == 'GET':
        return render(request, "query.html", {"title": "Kiểm tra kết quả giao dịch"})

    url = settings.VNPAY_API_URL
    secret_key = settings.VNPAY_HASH_SECRET_KEY
    vnp_TmnCode = settings.VNPAY_TMN_CODE
    vnp_Version = '2.1.0'

    vnp_RequestId = n_str
    vnp_Command = 'querydr'
    vnp_TxnRef = request.POST['order_id']
    vnp_OrderInfo = 'kiem tra gd'
    vnp_TransactionDate = request.POST['trans_date']
    vnp_CreateDate = datetime.now().strftime('%Y%m%d%H%M%S')
    vnp_IpAddr = get_client_ip(request)

    hash_data = "|".join([
        vnp_RequestId, vnp_Version, vnp_Command, vnp_TmnCode,
        vnp_TxnRef, vnp_TransactionDate, vnp_CreateDate,
        vnp_IpAddr, vnp_OrderInfo
    ])

    secure_hash = hmac.new(secret_key.encode(), hash_data.encode(), hashlib.sha512).hexdigest()

    data = {
        "vnp_RequestId": vnp_RequestId,
        "vnp_TmnCode": vnp_TmnCode,
        "vnp_Command": vnp_Command,
        "vnp_TxnRef": vnp_TxnRef,
        "vnp_OrderInfo": vnp_OrderInfo,
        "vnp_TransactionDate": vnp_TransactionDate,
        "vnp_CreateDate": vnp_CreateDate,
        "vnp_IpAddr": vnp_IpAddr,
        "vnp_Version": vnp_Version,
        "vnp_SecureHash": secure_hash
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(url, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        response_json = json.loads(response.text)
    else:
        response_json = {"error": f"Request failed with status code: {response.status_code}"}

    return render(request, "query.html", {"title": "Kiểm tra kết quả giao dịch", "response_json": response_json})

def refund(request):
    if request.method == 'GET':
        return render(request, "refund.html", {"title": "Hoàn tiền giao dịch"})

    url = settings.VNPAY_API_URL
    secret_key = settings.VNPAY_HASH_SECRET_KEY
    vnp_TmnCode = settings.VNPAY_TMN_CODE
    vnp_RequestId = n_str
    vnp_Version = '2.1.0'
    vnp_Command = 'refund'
    vnp_TransactionType = request.POST['TransactionType']
    vnp_TxnRef = request.POST['order_id']
    vnp_Amount = request.POST['amount']
    vnp_OrderInfo = request.POST['order_desc']
    vnp_TransactionNo = '0'
    vnp_TransactionDate = request.POST['trans_date']
    vnp_CreateDate = datetime.now().strftime('%Y%m%d%H%M%S')
    vnp_CreateBy = 'user01'
    vnp_IpAddr = get_client_ip(request)

    hash_data = "|".join([
        vnp_RequestId, vnp_Version, vnp_Command, vnp_TmnCode, vnp_TransactionType, vnp_TxnRef,
        vnp_Amount, vnp_TransactionNo, vnp_TransactionDate, vnp_CreateBy, vnp_CreateDate,
        vnp_IpAddr, vnp_OrderInfo
    ])

    secure_hash = hmac.new(secret_key.encode(), hash_data.encode(), hashlib.sha512).hexdigest()

    data = {
        "vnp_RequestId": vnp_RequestId,
        "vnp_TmnCode": vnp_TmnCode,
        "vnp_Command": vnp_Command,
        "vnp_TxnRef": vnp_TxnRef,
        "vnp_Amount": vnp_Amount,
        "vnp_OrderInfo": vnp_OrderInfo,
        "vnp_TransactionDate": vnp_TransactionDate,
        "vnp_CreateDate": vnp_CreateDate,
        "vnp_IpAddr": vnp_IpAddr,
        "vnp_TransactionType": vnp_TransactionType,
        "vnp_TransactionNo": vnp_TransactionNo,
        "vnp_CreateBy": vnp_CreateBy,
        "vnp_Version": vnp_Version,
        "vnp_SecureHash": secure_hash
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(url, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        response_json = json.loads(response.text)
    else:
        response_json = {"error": f"Request failed with status code: {response.status_code}"}

    return render(request, "refund.html", {"title": "Kết quả hoàn tiền giao dịch", "response_json": response_json})

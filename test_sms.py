import requests

res = requests.post(
    "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/",
    json={
        "ApiKey": "46EC719419B38A468819AF4F7C8FFD",
        "SecretKey": "AB3884A91CD3412B63A6ABCB4D89A7",
        "Phone": "0961494429",       
        "Content": "Test SMS tu he thong bai xe",
        "SmsType": "8",              
        "IsUnicode": "0",
        "Sandbox": "0"  
    },
    timeout=10
)
print(res.json())
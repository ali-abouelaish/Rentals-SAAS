## **Computershare Technnology Services Design Note API Integration** 

**Author** Lisa Bennett **Owner** Lisa Bennett **Reviewer** DPS project team **Version** 1.0 **Date** 18/04/2019 

COMPUTERSHARE CONFIDENTIAL 

## Document History 

|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|
|---|---|---|---|
|1.0|18/04/2019|Lisa Bennett|First Draft|
|1.1|20/02/2023|Lisa Bennett|Updates to URL|



© Copyright Computershare Technology Services Pty Ltd  ABN 85 058 216 014 No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or any means, electronic, photostatic, recorded or otherwise, without prior permission of Computershare Technology Services Pty Ltd. I 

|**1**|**INTRODUCTION ....................................................................................................................................... 1**|
|---|---|
|1.1|Purpose of the document ............................................................................................................................................................. 1|
|1.2|Intended Audience ....................................................................................................................................................................... 1|
|1.3|Project Background ...................................................................................................................................................................... 1|
|1.4|Requirements ............................................................................................................................................................................... 1|
|**2**|**OVERVIEW ............................................................................................................................................... 2**|
|2.1|Design Constraints....................................................................................................................................................................... 2|
|2.2|Preferred Solution ........................................................................................................................................................................ 2|
|2.3|Out of Scope ................................................................................................................................................................................ 3|
|**3**|**API AUTHENTICATION ........................................................................................................................... 4**|
|3.1|DPS API ....................................................................................................................................................................................... 4|
|3.2|Requesting an API client ID and client secret keys ..................................................................................................................... 4|
|3.3|Authentication mechanism ........................................................................................................................................................... 4|
|3.4|Request IDs ................................................................................................................................................................................. 7|
|3.5|Technical issues .......................................................................................................................................................................... 7|
|**4**|**API DOCUMENTATION ........................................................................................................................... 8**|
|4.1|POST Tenancy creation .............................................................................................................................................................. 8|
||4.1.1<br>Description .................................................................................................................................................................. 8|
||4.1.2<br>URL ............................................................................................................................................................................. 8|
||The data should be sent to the following URL:- ........................................................................................................................... 8|
||4.1.3<br>Create details .............................................................................................................................................................. 8|
|4.2|Request Data ............................................................................................................................................................................... 9|
||**4.2.1.1**<br>**POST request**............................................................................................................................................................. 9|
||4.2.2<br>POST success response ............................................................................................................................................. 9|
||4.2.3<br>POST error response .................................................................................................................................................. 9|
|4.3|Error Mapping ............................................................................................................................................................................ 10|
|**5**|**TESTING ................................................................................................................................................. 11**|
|**6**|**OAUTH 2.0 CLIENT  LIBRARIES .......................................................................................................... 12**|



II 

## **1 INTRODUCTION** 

## **1.1 Purpose of the document** 

The purpose of this document is to define the service API that will be exposed by the DPS to allow letting agents using the DPS to update the status of their created tenancies to Awaiting bank transfer. This will enable them to send in 1 payment for multiple depsosits and for that payment to auto allocate and update the deposit status to protected. The technical framework, architecture and implementation will be detailed. 

## **1.2 Intended Audience** 

This document is intended for:- 

- Letting agents – Clients of the DPS 

- Computershare – CTS project members 

- DPS – Account managers 

## **1.3 Project Background** 

Currently letting agents have to create tenancies in their own systems and then duplicate this in the DPS system. There is growing demand for an API to enable them to key this data into their own systems and send this to the DPS database via an API. This API will enable them to then update their tenancy status on the multiple tenancies created via the create tenancy API and enable an auto allocation of 1 payment. 

## **1.4 Requirements** 

The DPS solution will provide an application platform using an API for individuals to create tenancies and update the status of the tenancies through their own applications. 

1 

## **2 OVERVIEW** 

## **2.1 Design Constraints** 

The only constraint placed upon the delivery of the integration solution is that it should be compatible with current CTS infrastructure in terms of hosting and build environments. 

## **2.2 Preferred Solution** 

The preferred solution for integrating DPS update deposit status functionality within the letting agents own software is a Restful Service with a discoverable URL structure for HTTP requests. 

When a letting agent submits a request through their own application, the code in their application creates a web request with a specific URL and data content. The DPS  identifies the resource required from the incoming URI format and orchestrates the associated transaction. 

A POST will be submitted with content type as JSON. If the transaction processes successfully then the service returns a HTTP response with a 200 status code. Any requested data is returned as a JSON representation within the response data. 

If an error occurs then this is also returned via an HTTP status code. For example, if an application is incomplete or invalid then the service would return a ‘400’ error status code. 

2 

## **Figure 1 - Integration solution process flow** 

## **2.3 Out of Scope** 

The following can be considered out of scope for this project:- 

- Create tenancy API 

- Agent transfer API 

- Repayment/Initiate claims  API 

3 

## **3 API AUTHENTICATION** 

## **3.1 DPS API** 

DPS external APIs use oauth 2.0 protocol for authorisation. More specifically client credentials flow. 

Consuming APIs can be of 2 step process: 

1. Aquire oauth token 

2. Making API call using the acquired oauth token 

To aquire a token the user needs a client ID and client secret key. 

## **3.2 Requesting an API client ID and client secret keys** 

To request a key to access the Create Tenancy API, the Agent will need to contact their DPS Account Manager. They will then create your keys for a test and live API. The keys are randomly generated and will be emailed to their registered account email address. They will receive 2 emails realtime, 1 email will contain a Client ID and the other will contain their test and live client secret keys. Once these have been received the Agent can use these to obtain an access token to enable them to call the DPS API. 

There will be two sets of keys. 

1. Live keys (a client ID and a client secret) – these keys should be used once the integration to DPS goes live 

2. Test keys(a client ID and a client secret) – these keys should be used for development purposes. During development, DPS takes the requests and checks the request is valid and returns mock response. 

## **3.3 Authentication mechanism** 

When the Agent has received their Client ID and API keys they can request their access token by connecting to v1.0/connect/token using **basic authentication** . Basic authentication is a simple authentication schema built into HTTP protocol. The client sends HTTP requests with the **Authorization** header that contains the word **Basic** followed by a space and a base64encoded string ClientId:ClientSecret. 

For example: 

Client id = Demo 

Client secret = Password 

Base64_encoded_string = Base64_Encode_Function(Demo:Password) - **RGVtbzpQYXNzd29yZA==** 

4 

Now, make a http call to “<Endpoint>” with following header 

Header key = “Authorization” 

Header Value=   “Basic<single space> RGVtbzpQYXNzd29yZA==”. 

Content-types = application/x-www-form-urlencoded;charset=UTF-8 

grant_type=client_credentials (form urlencoded parameter) 

## **Final post request:** 

POST </oauth/token> Authorization: Basic RGVtbzpQYXNzd29yZA== Content-Type: application/x-www-form-urlencoded;charset=UTF-8 grant_type=client_credentials 

## **Curl:** 

$ curl -i -H 'Content-Type: application/x-www-form-urlencoded' -X POST '<Token end point>' –d 'grant_type=client_credentials' -H 'Authorization: Basic RGVtbzpQYXNzd29yZA==' 

The response will be a token which will expire in 20 minutes. For that 20 minutes, the user can use the same token to make HTTP calls to the different API’s that user can access. **Note:** As base64 is easily decoded, **basic authentication** should only be used together with other security mechanisms such as HTTPS/SSL. 

5 

## **Making an API call using oauth token** 

$ curl ‐H "Authorization: Bearer UAj2yiGAcMZGxfN2DhcUbl9v8WsR" ‐X POST '<End point>' 

POST <End point> Authorization: Bearer UAj2yiGAcMZGxfN2DhcUbl9v8WsR Content‐Type: application/json Post body: request 

6 

## **3.4 Request IDs** 

Each time a request is passed through to the API a request ID will be generated. If there is an issue when sending a request or an error,  this ID will be used by Computershare support teams to find the request in the logs and identify the issue. A request ID will look like the below: 

20615cfe-f5b7-45dd-8af4-5f402191168d 

A request ID will be present in the header and success response of the body and will be returned regardless of a success or failure. 

## **3.5 Technical issues** 

For any technical issues please contact your DPS account manager. 

7 

## **4 API DOCUMENTATION** 

## **4.1 POST Tenancy creation** 

## **4.1.1 Description** 

Updating a tenancy from awaiting payment to awaiting bank transfer for the letting agent on their DPS account. 

## **4.1.2 URL** 

The data should be sent to the following URL:- 

## **Table 1 – URI Location** 

|**Transaction**<br>Create (test environment)<br>Create|**Request**|**URLs**|**URLs**|
|---|---|---|---|
||POST|api-uat.depositprotection.com/v1.0/tenancy/MarkForBankTransfer||
||POST|api.depositprotection.com|/v1.0/tenancy/MarkForBankTransfer|



## **4.1.3 Create details** 

**Table 2 – Create details and parameters** 

|**Parameter**|**Min length**|**Max length**|**Valid format**|**Mandatory**|**Description**|**Comments**|**Data**<br>**Type**|
|---|---|---|---|---|---|---|---|
|Deposit ID|8|8|NNNNNNNN|Y|Deposit ID|Deposit reference is a valid<br>deposit string for the agent<br>(determined by the token) and<br>must be in state Awaiting<br>deposit payment|String|
|AllocationReference|1|18|AlphaNumeric|Y|Allocation<br>Reference||String|



8 

## **4.2 Request Data** 

## **4.2.1.1 POST request** 

{ "DepositId": "12345678", "AllocationReference": "abcde", } 

## **4.2.2 POST success response** 

{ "requestId": "8000039a-0000-da00-b63f-84710c7967bb", "response": { "paymentReference": "DP82770-38464" } } 

## **4.2.3 POST error response** 

When a there is a 400 bad request we will return an error response. Here is an example of what the response will look like if a field has failed validation rules. The last name field is a mandatory field and was not passed in the JSON: 

{ "error": { "code": "BadArgument", "message": "One or more errors in request", "target": "", "requestId": "7674da62-9e2d-4526-9f08-7dd9744c296e", "details": [ { "field": "BadArgument", "errors": [ { "code": "BadArgument", "message": "One or more errors in request" }] } 

9 

## **4.3 Error Mapping** 

When validation detects an error a context specific code will be returned in order to be mapped by the letting agent.. 

## **Table 3 – Error Mapping Table** 

|**Status**|**Error Code**|**Error reason**|
|---|---|---|
|400|“Required”|A required property is missing|
|400|“LengthCriteria”|A string is outside the accepted range (above or below)|
|400|“InvalidData ”|Does not confirm to the specified format.|
|400|“InvalidCharacters”|Invalid characters for the datatype|
|400|“BadArgument”|Invalid enum|
|**Token request**|||
|400|“Required”|missing id or secret|
|400|“BadArgument”|clientid not in correct format|



10 

## **TESTING** 

To test the API the test keys are required that can be requested through your account manager (see section 3.2). Once the Agent has received their Test Client ID and API key they can request their access token by connecting to /v1.0/connect/token. This will generate their token to access the test environment. The rules and validation for passing through the data are the same for both test and live APIs. The success and error responses will be returned the same. If the data being passed is test data, we will not store this in the database but will return a mock response. To see the expected responses see section 4.2.2 and 4.2.3. 

11 

**6 OAUTH 2.0 CLIENT  LIBRARIES** 

https://oauth.net/code/ - 

12 


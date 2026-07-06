## **Computershare Technnology Services Design Note API Integration** 

**Author** Lisa Bennett **Owner** Lisa Bennett **Reviewer** DPS project team **Version** 3.1 **Date** 10/09/2018 

COMPUTERSHARE CONFIDENTIAL 

## Document History 

|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|**Version**<br>**Date**<br>**Author**<br>**Summary of changes**|
|---|---|---|---|
|1.0|01/03/2018|Lisa Bennett|First Draft|
|1.1|27/03/2018|Lisa Bennett|Updated error codes|
|2.0|19/04/2018<br>|Lisa Bennett|Add in authentication details|
|2.1|19/06/2018|Lisa Bennett|Add in access token process|
|2.3|26/06/2018|Lisa bennett|Updated details|
|2.4|28/06/2018|Lisa Bennett|Updated validation rules|
|3.0|02/08/2018|Lisa Bennett|Added accepted special characters|
|3.1|10/09/2018|Lisa Bennett|Updates to formatting|
|3.2|20/02/2022|Lisa Bennett|Updates to URL|



> © Copyright Computershare Technology Services Pty Ltd  ABN 85 058 216 014 No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or any means, electronic, photostatic, recorded or otherwise, without prior permission of Computershare Technology Services Pty Ltd. I 

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
|4.2|Special characters accepted ...................................................................................................................................................... 13|
|4.3|Request Data ............................................................................................................................................................................. 16|
||**4.3.1.1**<br>**POST request**........................................................................................................................................................... 16|
||4.3.2<br>POST success response ........................................................................................................................................... 18|
||4.3.3<br>POST error response ................................................................................................................................................ 18|
|4.4|Error Mapping ............................................................................................................................................................................ 19|
|5.0|Accepted country codes ........................................................................................................................................................... 19|
|**5**|**TESTING ................................................................................................................................................. 24**|
|**6**|**OAUTH 2.0 CLIENT  LIBRARIES .......................................................................................................... 25**|



II 

## **1 INTRODUCTION** 

## **1.1 Purpose of the document** 

The purpose of this document is to define the service API that will be exposed by the DPS to allow letting agents using the DPS to submit deposits via their own application. The technical framework, architecture and implementation will be detailed. 

## **1.2 Intended Audience** 

This document is intended for:- 

- Letting agents – Clients of the DPS 

- Computershare – CTS project members 

- DPS – Account managers 

## **1.3 Project Background** 

Currently letting agents have to create tenancies in their own systems and then duplicate this in the DPS system. There is growing demand for an API to enable them to key this data into their own systems and send this to the DPS database via an API. They will still need to login to their DPS account to make payment. 

## **1.4 Requirements** 

The DPS solution will provide an application platform using an API for individuals to create tenancies through their own applications. 

1 

## **2 OVERVIEW** 

## **2.1 Design Constraints** 

The only constraint placed upon the delivery of the integration solution is that it should be compatible with current CTS infrastructure in terms of hosting and build environments. 

## **2.2 Preferred Solution** 

The preferred solution for integrating DPS create tenancy functionality within the letting agents own software is a Restful Service with a discoverable URL structure for HTTP requests. 

When a letting agent submits a tenancy in the their application, the code in their application creates a web request with a specific URL and data content. The DPS  identifies the resource required from the incoming URI format and orchestrates the associated transaction. 

A POST will be submitted with content type as JSON. If the transaction processes successfully then the service returns a HTTP response with a 200 status code. Any requested data is returned as a JSON representation within the response data. 

If an error occurs then this is also returned via an HTTP status code. For example, if an application is incomplete or invalid then the service would return a ‘400’ error status code. 

2 

## **Figure 1 - Integration solution process flow** 

## **2.3 Out of Scope** 

The following can be considered out of scope for this project:- 

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

When the Agent has received their Client ID and API keys they can request their access token by connecting to /v1.0/connect/token using **basic authentication** . Basic authentication is a simple authentication schema built into HTTP protocol. The client sends HTTP requests with the **Authorization** header that contains the word **Basic** followed by a space and a base64encoded string ClientId:ClientSecret. 

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

Creating a tenancy for the letting agent on their DPS account. 

## **4.1.2 URL** 

The data should be sent to the following URL:- 

## **Table 1 – URI Location** 

|**Transaction**<br>Create(test environment)<br>Create|**Request**|**URLs**|**URLs**|
|---|---|---|---|
||POST|api-uat.depositprotection.com/v1.0/tenancy/create||
||POST|api.depositprotection.com|/v1.0/tenancy/create|



## **4.1.3 Create details** 

**Table 2 – Create details and parameters** 

|**Parameter**|**Min length**|**Max length**|**Valid format**|**Mandatory**|**Description**|**Comments**|**Data**<br>**Type**|
|---|---|---|---|---|---|---|---|
|**AgentLandlord ID**|7|7|NNNNNNN|Y|Agent/ Landlord ID<br>number||Number|
|**AddressLine 1**|1|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|Y|Tenancy address<br>line 1||String|
|**AddressLine 2**|1|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|N|Tenancy address<br>line 2||String|



8 

|**AddressLine 3**|1|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|N|Tenancy address<br>line 3||String|
|---|---|---|---|---|---|---|---|
|**Town**|1|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|Y|Tenancy address<br>Town||String|
|**County**|1|60|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|N|Tenancy address<br>County||String|
|**Postcode**|1|12|Alphanumeric and<br>spaces. Must be an<br>English or Welsh<br>postcode.|Y|Tenancy address<br>postcode|The postcode will be validated<br>to ensure it is a valid postcode<br>format within England and<br>Wales|String|
|**PropertyType**|N/A|N/A|> Terraced<br>>Detached<br>>Semi-detached<br>>Flat/Apartment<br>>Maisonette<br>>Bungalow<br>>Studio/Bedsit|N|Tenancy property<br>type|Property type to be passed as<br>a number:<br>1 > Terraced<br>2 > Detached<br>3 > SemiDetached<br>4 > FlatApartment<br>5 > Maisonette<br>6 > Bungalow<br>7 > StudioBedsit<br>If a Null value is passed this<br>will be stored as unknown.|Enum|
|**FurnishingType**|N/A|N/A|>Furnished<br>>Unfurnished<br>>PartFurnished<br>>WhiteGoodsOnly|N|Tenancy furnishing<br>type|Furnishing type to be passed<br>as a number:<br>0 > NotGiven<br>1 > Furnished<br>2 > Unfurnished<br>3 > PartFurnished<br>4>WhiteGoodsOnly|Enum|



9 

|||||||If a Null value is passed this<br>will be stored as NotGiven.||
|---|---|---|---|---|---|---|---|
|**NumberOfBedrooms**|1|3|Numeric between 0<br>and 255|N|Number of<br>bedrooms in<br>property||Number|
|**RentAmount**|0.01|99,999.99|Numeric between<br>0.01 and 99,999.99|Y|Tenancy rental<br>amount|Sterling only.|Number<br>(decimal)|
|**RentFrequency**|N/A|N/A|> Monthly<br>> 4Weekly<br>> Weekly|Y|Tenancy rental<br>frequency|Rent frequency to be passed<br>as a number:<br>0 > Unknown<br>1 > Monthly<br>2 > 4Weekly<br>3 > Weekly|Enum|
|**TenancyStartDate**|10|10|DD/MM/YYYY<br>Numeric and special<br>character /|Y|Date the tenancy<br>started||Date|
|**TenancyLength**|1|3|Numeric between 1<br>and 108|Y|Length of tenancy<br>in months||Number|
|**DepositAmount**|0.01|999,999.99|Numeric between<br>0.01 and 999,999.99|Y|Deposit amount|Amount will always be treated<br>as sterling only.||
|**DatePaid**|10|10|DD/MM/YYYY<br>Numeric and special<br>character / - Date<br>must be before the<br>tenancy start date|Y|Date the tenant<br>paid their deposit<br>to the landlord||Date|
|**TenancyReference**|3|35|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|N|Reference field for<br>agent to enter<br>unique reference<br>for tenancy||String|



10 

|**Tenants**|**Up to 10 tenants can be passed through. There is a minimum of 1 tenant on a tenancy.**|**Up to 10 tenants can be passed through. There is a minimum of 1 tenant on a tenancy.**|**Up to 10 tenants can be passed through. There is a minimum of 1 tenant on a tenancy.**|**Up to 10 tenants can be passed through. There is a minimum of 1 tenant on a tenancy.**|**Up to 10 tenants can be passed through. There is a minimum of 1 tenant on a tenancy.**|||
|---|---|---|---|---|---|---|---|
|||||||||
|**Tenant Title**<br>**“Title”**|1|30|Alphanumeric|Y|Title of tenant 1|Alphanumeric|String|
|**Tenant first name**<br>**“FirstName”**|2|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|Y|||String|
|**Tenant last name**<br>**“LastName”**|2|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|Y|||String|
|**Tenant mobile country code**<br>**“MobileNumberCountryCode”**|2|4|Must match|N|Must be entered if<br>email address is<br>not given<br>If country code is<br>not provided this<br>will default to the<br>UK.|Country codes accepted listed<br>in section 4 of this document<br>See mobile number validation<br>in table 4.|String|
|**Tenant mobile number**<br>**“MobileNumber”**|11|11|Numeric, spaces and<br>special characters|N|Must be entered if<br>email address is<br>not given. Cannot<br>be the same as<br>agnt/LL or relevant<br>person|See mobile number validation<br>in table 4.|String|
|**Tenant other phone country**<br>**code**|1|5|Numeric, spaces and<br>special characters|N||See other number validation in<br>table 4.|String|



11 

|**“OtherTelephoneCountryCode”**||||||||
|---|---|---|---|---|---|---|---|
|**Tenant other phone number**<br>**“OtherTelephone”**|5|20|Numeric, spaces and<br>special characters|N||See other number validation in<br>table 4.|String|
|**Tenant email address**<br>**“EmailAddress”**||99|Must be in a valid<br>format and max of<br>99 characters|N|Must be entered if<br>mobile number is<br>not given<br>Must not match<br>that of<br>Agent/Landlord,<br>relevant person or<br>another tenant||String|
|**TenantReference**|3|35|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|N|Reference field for<br>agent to enter<br>unique reference<br>for tenant||String|
|||||||||
|**Relevant person**||||N||This is not mandatory data for<br>a tenancy.<br>A relevant person is someone<br>who has paid part or all of the<br>deposit on behalf of the tenant.<br>The relevant person is not<br>authorised to take any action<br>on the deposit. We will provide<br>them with a copy of the<br>deposit protection certificate<br>for information only.||
|**Contact’s first name**<br>**“firstname”**|1|50|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|Y||If relevant person is passed in<br>the data|String|
|**Contact’s last name**<br>**“lastname”**|2|50|Alphanumeric,<br>spaces and special|Y||If relevant person is passed in<br>the data|String|



12 

||||characters: See<br>table 3 section 4.2.|||||
|---|---|---|---|---|---|---|---|
|**Company name**<br>**“companyname”**|2|35|Alphanumeric,<br>spaces and special<br>characters: See<br>table 3 section 4.2.|N|||String|
|**Contact’s email address**<br>**“emailaddress”**||99|Must be in a valid<br>format and max of<br>99 characters|Y|Must not match<br>that of<br>Agent/Landlord or<br>tenant|If relevant person is passed in<br>the data|String|
|**Contact’s mobile number**<br>**country code**<br>**“mobilenumbercountrycode”**|1|5|Must match|N|If country code is<br>not provided then<br>this will default to<br>UK|Country codes accepted listed<br>in section 4 of this document|String|
|**Contact’s mobile number**<br>**“mobilenumber”**|9|15|Numeric, spaces and<br>special characters|N||See mobile number validation<br>in table 4.|String|



## **4.2 Special characters accepted** 

## **Table 3– Accepted special characters** 

|¡|¼|Ø|ï|
|---|---|---|---|
|¢|½|Ù|ð|
|£|¾|Ú|ñ|
|¤|¿|Û|ò|
|¥|À|Ü|ó|
|¦|Á|Ý|ô|
|§|Â|Þ|õ|
|¨|Ã|ß|ö|



13 

|©|Ä|à|÷|
|---|---|---|---|
|ª|Å|á|ø|
|«|Æ|â|ù|
|¬|Ç|ã|ú|
|®|È|ä|û|
|¯|É|å|ü|
|°|Ê|æ|ý|
|±|Ë|ç|þ|
|²|Ì|è|ÿ|
|³|Í|é|Ô|
|´|Î|ê|Õ|
|μ|Ï|ë|Ö|
|¶|Ð|ì|×|
|·|Ñ|í|¹|
|¸|Ò|î|º|
||Ó|»||



**Table 4– Mobile phone number validation rules** 

|Country code|Mobile # begins|Country code<br>mandatory?|Mobile #<br>mandatory?|Min Length|Max Length|Database Country<br>Code|
|---|---|---|---|---|---|---|
|44, +44, GB, gb|07|N/A|Y if email address<br>not provided for<br>tenant|11|11|GB|



14 

|Not GB|0 (not 07)|N/A|Y if email address<br>not provided for<br>tenant|11|15|Any other country<br>listed in table 5|
|---|---|---|---|---|---|---|
|Not GB|1, 2,.., 9|N/A|Y if email address<br>not provided for<br>tenant|9|13|Any other country<br>listed in table 5|
|Field removed|07|N/A|Y if email address<br>not provided for<br>tenant|11|11|GB|
|Empty String|07|N/A|Y if email address<br>not provided for<br>tenant|11|11|GB|
|Null|07|N/A|Y if email address<br>not provided for<br>tenant|11|11|GB|
|Any valid|Field removed|No|N/A|N/A|N/A|Any valid|
|Any valid|Empty String|No|N/A|N/A|N/A|Any valid|
|Any valid|Null|No|N/A|N/A|N/A|Any valid|



**Table 5– Other phone number validation rules** 

|Country code|Other number begins|Country code<br>mandatory?|Mobile Number<br>mandatory?|Min Length|Max Length|Database Country<br>Code|
|---|---|---|---|---|---|---|
|44, +44, GB, gb|Any #|N/A|No|5|20|GB|
|Not GB|Any #|N/A|No|5|20|Any other country<br>listed in table 5|
|Field removed|Any #|N/A|No|5|20|GB|



15 

|Empty String|Any #|N/A|No|5|20|GB|
|---|---|---|---|---|---|---|
|Null|Any #|N/A|No|5|20|GB|
|Any valid|Field removed|No|N/A|N/A|N/A|Any valid|
|Any valid|Empty String|No|N/A|N/A|N/A|Any valid|
|Any valid|Null|No|N/A|N/A|N/A|Any valid|



## **4.3 Request Data** 

## **4.3.1.1 POST request** 

## **Request to create tenancy with relevant person** 

{ "AgentLandlordId": {{1234567}}, "DatePaid": "2018-05-17", "PropertyType": "Maisonette", "FurnishingType": "Furnished", "NumberOfBedrooms": 255, "RentAmount": "90.1", "RentFrequency": 3, "TenancyStartDate": "2018-05-21", "TenancyLength": 108, "DepositAmount": "4800.25", "TenancyReference": "ABC 123", "AddressLine1": "4 High Street", "AddressLine2": "Seaton", "AddressLine3": "Devon", "Town": "Devon", "PostCode": "BS1 2AA", "Tenants": [ { "tenantReference": "My tenant", "title": "Mr", "firstName": "Leon", "lastName": "Spinks", "emailAddress": "A@B.C", "MobileNumberCountryCode": "+44", 

16 

"mobileNumber": "07777777771", "otherTelephoneCountryCode": "+44", "otherTelephone": "07888888888" } 

], "RelevantPerson":{ 

"firstName": "firstname", "lastName": "lastname", "emailAddress": "tnt1firstname_3310@test.com", "MobileNumberCountryCode": "+44", "mobileNumber": "07867234062", "CompanyName":"magic company" } } 

## **Request to create tenancy without relevant person** 

{ "AgentLandlordId": {{1234567}}, "DatePaid": "2018-05-17", "PropertyType": "Maisonette", "FurnishingType": "Furnished", "NumberOfBedrooms": 255, "RentAmount": "90.1", "RentFrequency": 3, "TenancyStartDate": "2018-05-21", "TenancyLength": 108, "DepositAmount": "4800.25", "TenancyReference": "ABC 123", "AddressLine1": "4 High Street", "AddressLine2": "Seaton", "AddressLine3": "Devon", "Town": "Devon", "PostCode": "BS1 2AA", " Tenants": [ { "tenantReference": "My tenant", "title": "Mr", "firstName": "Leon", "lastName": "Spinks", "emailAddress": "A@B.C", "MobileNumberCountryCode": "+44", "mobileNumber": "07777777771", "otherTelephoneCountryCode": "+44", 

17 

"otherTelephone": "07888888888" } ], "RelevantPerson":null } 

## **4.3.2 POST success response** 

"deposit ID": "29933400" } 

## **4.3.3 POST error response** 

When a there is a 400 bad request we will return an error response. Here is an example of what the response will look like if a field has failed validation rules. The last name field is a mandatory field and was not passed in the JSON: 

{ "error": { "code": "BadArgument", "message": "One or more errors in Create tenancy", "target": "Create tenancy", "requestId": "7674da62-9e2d-4526-9f08-7dd9744c296e", "details": [ { "field": "Tenants[0].LastName", "errors": [ { "code": "Required", "message": "Please enter last name" }, ] 

18 

} ] } 

## **4.4 Error Mapping** 

When validation detects an error a context specific code will be returned in order to be mapped by the letting agent.. 

## **Table 3 – Error Mapping Table** 

|**Status**|**Error Code**|**Error reason**|
|---|---|---|
|400|“Required”|A required property is missing|
|400|“LengthCriteria”|A string is outside the accepted range (above or below)|
|400|“InvalidData ”|Does not confirm to the specified format.|
|400|“InvalidCharacters”|Invalid characters for the datatype|
|400|“Duplication”|Email or mobiles duplicated|
|400|“BadArgument”|Invalid enum|
|**Token request**|||
|400|“Required”|missing id or secret|
|400|“BadArgument”|clientid not in correct format|



## **5.0 Accepted country codes** 

When creating a tenancy with a phone number, these are the accepted values for the country code. 

**Table 5 – Accepted country codes** 

**CountryName CountryCode Column1 Column2** 

19 

|Andorra|376|Sri Lanka|94|
|---|---|---|---|
|United Arab Emirates|971|Liberia|231|
|Afghanistan|93|Lesotho|266|
|Antigua And Barbuda|1268|Lithuania|370|
|Anguilla|1264|Luxembourg|352|
|Albania|355|Latvia|371|
|Armenia|374|Libya|218|
|Netherlands Antilles|599|Morocco|212|
|Angola|244|Monaco|377|
|Argentina|54|Republic Of Moldova|373|
|Austria|43|Madagascar|261|
|Australia|61|Republic Of The Marshall Islands|692|
|Aruba|297|Republic Of Macedonia|389|
|Azerbaijan|994|Mali|223|
|Bosnia And Herzegovina|387|Mongolia|976|
|Barbados|1246|Macau|853|
|Bangladesh|880|Martinique|596|
|Belgium|32|Mauritania|222|
|Burkina Faso|226|Montserrat|1664|
|Bulgaria|359|Malta|356|
|Bahrain|973|Mauritius|230|
|Burundi|257|Maldives|960|
|Benin|229|Malawi|265|
|Bermuda|1441|Mexico|52|
|Brunei|673|Malaysia|60|
|Bolivia|591|Mozambique|258|
|Brazil|55|Namibia|264|
|Bahamas|1242|New Caledonia|687|
|Bhutan|975|Niger|227|
|Botswana|267|Norfolk Island|672|
|Belarus|375|Nigeria|234|
|Belize|501|Nicaragua|505|
|Canada|1|Netherlands|31|
|Democratic Republic Of The Congo|242|Norway|47|
|Central African Republic|236|Nepal|977|
|Congo|242|Nauru|674|
|Switzerland|41|Niue|683|



20 

|Côte dIvoire|225|New Zealand|64|
|---|---|---|---|
|Cook Islands|682|Oman|968|
|Chile|56|Panama|507|
|Cameroon|237|Peru|51|
|China|86|French Polynesia|689|
|Columbia|57|Papua New Guinea|675|
|Costa Rica|506|Phillipines|63|
|Cuba|53|Pakistan|92|
|Cape Verde|238|Poland|48|
|Cyprus|357|Saint Pierre And Miquelon|508|
|Czech Republic|420|Pitcairn|0|
|Germany|49|Puerto Rico|1787|
|Djibouti|253|Portugal|351|
|Denmark|45|Republic Of Paraguay|595|
|Dominica|1767|Qatar|974|
|Dominican Republic|1809|Réunion|262|
|Algeria|213|Romania|40|
|Ecuador|593|Russia|70|
|Estonia|372|Rwanda|250|
|Egypt|20|Saudi Arabia|966|
|State Of Eritrea|291|Solomon Islands|677|
|Spain|34|Seychelles|248|
|Ethiopia|251|Sudan|249|
|Finland|358|Sweden|46|
|Fiji|679|Singapore|65|
|Falkland Islands|+|Saint Helena|290|
|Federated States Of|691|Slovenia|386|
|Faeroe Islands|298|Slovakia|421|
|France|33|Sierra Leone|232|
|Gabon|241|San Marino|378|
|Grenada|1473|Senegal|221|
|Georgia|995|Somalia|252|
|Guiana|594|Suriname|597|
|Ghana|233|Sao Tome And Principe|239|
|Gibraltar|350|El Salvador|503|
|Greenland|299|Syrian Arab Republic|963|
|Gambia|220|Swaziland|268|



21 

|Guinea|224|Turks And Caicos Islands|1649|
|---|---|---|---|
|Guadeloupe|590|Chad|235|
|Equatorial Guinea|240|Togo|228|
|Greece|30|Thailand|66|
|Guatemala|502|Tajikistan|992|
|Guam|1671|Tokelau|690|
|Guinea-Bissau|245|Turkmenistan|7370|
|Guyana|592|Tunisia|216|
|HongKong|852|Tonga|676|
|Honduras|504|Turkey|90|
|Croatia|385|Trinidad And Tobago|1868|
|Haiti|509|Tuvalu|688|
|Hungary|36|Taiwan|886|
|Indonesia|62|Tanzania|255|
|Ireland|353|Ukraine|380|
|Israel|972|Uganda|256|
|India|91|United Kingdom|44|
|Iraq|964|United Kingdom|44|
|Iran|98|United States Of America|1|
|Iceland|354|Uruguay|598|
|Italy|39|Uzbekistan|998|
|Jamaica|1876|Saint Vincent And The Grenadines|1784|
|Jordan|962|Venezuela(Bolivarian Republic Of)|58|
|Japan|81|Virgin Island(British)|1284|
|Kenya|254|Virgin Island(U.S.)|1340|
|Kyrgyzstan|996|Viet Nam|84|
|Cambodia|855|Vanuatu|678|
|Kiribati|686|Wallis And Futuna Islands|681|
|Comoros|269|Samoa|684|
|Saint Kitts And Nevis|1869|Yemen|967|
|Democratic Peoples RepOf Korea|850|Mayotte|269|
|Korea|82|South Africa|27|
|Kuwait|965|Zambia|260|
|Cayman Islands|1345|Zimbabwe|263|
|Kazakhstan|7|United Kingdom|44|
|Lao People’s Democratic Republic|856|United Kingdom|44|
|Lebanon|961|Spain|34|



22 

|Saint Lucia|1758|France|33|
|---|---|---|---|
|Liechtenstein|423|Ireland|353|
|France|33|Italy|39|
|Ireland|353|Poland|48|
|Italy|39|Spain|34|
|Poland|48|||



23 

**5 TESTING** 

To test the API the test keys are required that can be requested through your account manager (see section 3.2). Once the Agent has received their Test Client ID and API key they can request their access token by connecting to /v1.0/connect/token. This will generate their token to access the test environment. The rules and validation for passing through the data are the same for both test and live APIs. The success and error responses will be returned the same. If the data being passed is test data, we will not store this in the database but will return a mock response. To see the expected responses see section 4.3.2 and 4.3.3. 

24 

**6 OAUTH 2.0 CLIENT  LIBRARIES** 

https://oauth.net/code/ - 

25 


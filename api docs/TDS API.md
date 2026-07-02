Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## TDS Custodial Deposit Management API 

**Revision Number: 1.10** 

**Date: 19/11/2024** 

## **1.1 Confidentiality & Notices** 

This document is the property of The Dispute Service Ltd, whose proprietary rights are included in the information disclosed herein. 

The recipient, by accepting this document, agrees that neither this document, nor the information disclosed herein, nor any part thereof shall be reproduced by any means graphic, electronic or mechanical, including photocopying, recording, taping or in information storage and retrieval systems or transferred to other documents or used or disclosed to others for manufacturing or for any other purpose except as specifically authorised in writing by The Dispute Service Ltd. 

Copyright 2021 the Dispute Service Ltd. All Rights Reserved. 

All trademarks and commercially protected names and terms used or referred to within this document are hereby acknowledged as belonging to and being the property of their respective owners. 

**Commercial in confidence** 

**Page 1 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **1.2 Document History** 

|**Revision**<br>**Number**|**Author**|**Reason for change**|**Issue Date**|
|---|---|---|---|
|0.9|Michael Jones,<br>Simon Hardingham,<br>François Josserand|Consolidated changes and added details of the<br>new sandbox environment|26th March 2019|
|1.0|Andrew Owusu &<br>Jorden Adams|Updated document to provide clearer examples<br>and be prescriptive|12th August 2019|
|1.1|Andrew Owusu &<br>Jorden Adams|Updated document to state the current version<br>of the API & add details to the<br>“user_tenancy_reference” field in the “tenancy”<br>object|9th September 2019|
|1.2|Andrew Owusu &<br>Jorden Adams|Updated document to include the endpoint for<br>the deposit creation service|15th October 2019|
|1.3|Andrew Owusu &<br>Jorden Adams|Updated the**“furnished_status” **example in<br>the Deposit Protection (tenancy) object from<br>“Y” to “furnished” & the**api_key**example|28th October 2019|
|1.4|Amanda Portman|Updated document to reflect that for single<br>branch members, the branch ID is 0|8thDecember 2020|
|1.5|Dan Sanderson|Updated to include new enhancements for<br>searching landlords and properties|07thMay 2021|
|1.6|Dan Sanderson|Updated to include Repayment Request<br>features|21stJune 2021|
|1.7|Dan Sanderson|Updated to include return of DPC|31stAugust 2021|
|1.8|Richard Frost|Add additional Repayment Request error<br>message.|23rdApril 2022|
|1.9|Dan Sanderson|Add additional endpoints<br>•<br>Create head office branch<br>•<br>Create branch user|28thAugust 2024|
|1.10|Alex Hillier|Added API usage note|19thNovember 2024|



**Commercial in confidence** 

**Page 2 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Table of contents** 

|**1**|Document Control|2|
|---|---|---|
|**1.1**|Confidentiality & Notices|2|
|**1.2**|Revision History|2|
|**1.3**|Document Clarification|3|
|**2**|Introduction|4|
|**2.1**|Data Requirements|4|
|**2.2**|API Processing|4|
|**2.3**|API URLs|5|
|**3**|Deposit Creation|6|
|**3.1**|Creation Status|14|
|**4**|Tenancy Information|17|
|**5**|Landlords|19|
|**6**|Properties|23|
|**7**|Repayment Request|27|
|**8**|Deposit Protection Certificate|30|
|**9**|Create Head Office Branch|32|
|**10**|Create Head Office Branch User|35|



## **1.3 Document Clarification** 

Any questions or queries regarding this report should be addressed to: 

**Address:** The Dispute Service Ltd West Wing First Floor, The Maylands Building 200 Maylands Avenue Hemel Hempstead Herts HP2 7TG **Phone:** +44 (0) 1442 2210 8011 **Email :** api_enquiries@tenancydepositscheme.com 

**Commercial in confidence** 

**Page 3 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **2 Introduction** 

## **Purpose:** 

The document describes the API provided by TDS (API Custodial) to 3rd party platform providers for Agents & Landlords. 

## **Scope:** 

This document is intended to describe the API interface (messaging formats only) to the TDS Custodial system to create new deposits and is not intended to describe the custodial scheme rules imposed by the TDS. 

A RESTful service using JSON as a data format has been implemented. Access to the API is controlled using an API key obtained from the TDS Custodial system. 

## **Audience:** 

This document is written for technical suppliers implementing clients of this API. 

## **2.1 Data requirements** 

The data TDS requires includes: 

- Address of the property 

- Name and address of the landlord (address can be c/o the agent) 

- Dates of the tenancy 

- Deposit amount 

- Tenant(s) name(s) and contact details 

## **2.2 API Processing** 

The API service only allows for the creation of new deposits in the **“Registered (not paid)”** status. 

Deposits cannot be edited or updated via the API. 

If the same details are provided in two separate calls to the service, two new identical deposits will be created. 

The creation process is asynchronous and so two services are provided. 

The first of these is the deposit creation service which allows the posting of all required deposit information together with scheme and authentication information in order for it to be added to the processing queue. 

The service will then perform structural checks on the request and validate the authentication information and permissions. If the request does not pass these checks a failure response is generated together with an indication of the nature of the error. 

**Commercial in confidence** 

**Page 4 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

If no issues are found at this point, the request is passed onto the processing queue and a success status returned. 

In order to check the status and success or otherwise of the creation within the portal of the deposit, it is necessary to poll a second service. This reports the current processing status as well as detailed error information relating to the processing of the deposit creation. It can take some time for the queue to be processed depending on load and usage and so the client should continue to poll for updates until a completed status is returned. 

Details on the specific calls are provided below. 

## **2.3 API URLs** 

The URL for the live environment is: 

https://api.custodial.tenancydepositscheme.com 

The URL for the sandbox environment is: 

https://sandbox.api.custodial.tenancydepositscheme.com 

**Note:** The API version will only ever use 1 decimal place, v0.9, 0.9.1 and v0.9.1.5 will all use the version ‘v0.9’. 

The current version of the sandbox API is 1.2. 

The current version of the live API is 1.2. 

## **2.4 API Usage** 

The system data structure for tenancies is as follows: 

Head Office – Branch Office - Tenancies 

Users can sit under head office or branch office. Those that sit at head office level have access to all branch offices unless they have a report only function. Those users that sit at branch office level only have access to this level. 

## **Agent** 

The API is traditionally used by Agents to protect deposits on behalf of member landlords. These tenancies will sit under the branch office. 

## **Direct Landlord** 

Where providers want to allow landlords to protect deposits directly the structure of the data needs to be configured in a way the landlord has access to their exclusive area. 

To enable this the data structure should be as follows: 

Head office – Branch Office per Landlord – Landlord User. 

The provider will setup landlords with a branch office named after the landlord and then create the landlord user. This will allow for a unique Branch ID that can be identified with the landlord. 

**Commercial in confidence** 

**Page 5 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **3 Deposit creation (deposit protection registration)** 

The request to create a new deposit contains the following meta information: 

- Authentication and identification credentials 

- Deposit object 

- Person object(s) 

**Note:** Deposit creation requests are queued and processed asynchronously. 

## **Request** 

This service is a POST request of the following form: 

**`POST /<site URL>/<API version>/CreateDeposit`** 

## **For example:** 

**`POST /api.custodial.tenancydepositscheme.com/v1.2/CreateDeposit`** 

## **Authentication information** 

At the start of the data object information must be passed which authenticates and identifies the member and optionally branch to which the deposits should be appended. 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|member_id|188832|Yes|The member_id as supplied by TDS Custodial.|Must be 1 - 6 alphanumeric<br>characters|
|branch_id|188832|Yes|The branch_id as supplied by TDS Custodial.<br>For single branch members, the branch ID is 0.<br>Members that have more than one branch will always have<br>differing branch and member IDs.<br>If the branch_id is set to “-1” then a new branch is created<br>for the head office provided in the member_id.|Must be 1 - 6 alphanumeric<br>characters|
|api_key|35467-<br>65389-<br>26539-<br>97536|Yes|The unique secret API key assigned to the Head<br>office/branch used to authenticate the call is valid for the<br>member.||
|scheme_type|Custodial|Yes|The scheme in which the deposit should be created.|Supported values are:<br>●<br>Custodial<br>●<br>Insured|
|region|EW|Yes|EW for England and Wales scheme, NI for Northern Ireland|Supported values are:<br>●<br>EW<br>●<br>NI|



**Commercial in confidence** 

**Page 6 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Deposit Protection (tenancy) object** 

A deposit protection (tenancy) object contains all the information required to create a single deposit. 

A deposit contains top-level information about the tenancy such as: 

- Property details and 

- Rent information, 

- 2 or more “people records” to define all the individuals related to a deposit. 

There must be at least one “Lead Tenant” and one landlord for each deposit. 

In the event there are 3 tenants, a landlord and a related party, 5 person objects is required. 

Person objects are defined later in this document. 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|user_tenancy_reference|1022|Yes|Your external reference for this deposit|Each request must have a<br>unique<br>“user_tenancy_reference”<br>otherwise this results in a<br>validation error|
|property_id|1|No|Your unique reference to this property.<br>If a “property_id” already exists within the<br>TDS Custodial system, the deposit will be<br>linked to the pre-existing property record.||
|property_paon|40<br>or<br>The Corner<br>House|Yes|This is the “building name” or “building<br>name” of the rented property.<br>In essence the house number or name.|Must be between 1 and 100<br>alphanumeric characters.|
|property_saon|Flat 6<br>or<br>Room 2|No|This isonly requiredwhen the ”building<br>name” or “building number”<br>(property_paon) is insufficient for example<br>'Flat 2'.|Must be between 1 and 100<br>alphanumeric characters.|
|property_street|West Georgies<br>Place|West Georgies<br>Yes|The street where the rented property is<br>located.|Must be between 1 and 100<br>alphanumeric characters.|
|property_locality|Kings<br>Industrial<br>Estate|No|Locality where rented property is located<br>(suburb, parish, industrial estate).|Must be between 3 and 100<br>alphanumeric characters.|
|property_town|Edinburgh|Yes|Town where the rented property is located.  Must be between 3 and 100|Town where the rented property is located.  Must be between 3 and 100<br>alphanumeric characters|
|property_administrative_area|Midlothian|Yes|The county or state where the rented<br>property is located.|Must be between 3 and 100<br>alphanumeric, period and<br>hyphen characters.|
|property_postcode|EH14 1BF|Yes|Postcode for the rented property.|Must be between 1 and 8<br>alphanumeric characters.|
|tenancy_start_date|20/03/2017|Yes|Start date of tenancy agreement|DD-MM-YYYY<br>Must be a date between<br>01/01/1980 and 31/12/2099|
|tenancy_expected_end_date|19/03/2018|Yes|Expected end date of tenancy (tenancy<br>agreement end date).|DD-MM-YYYY:<br>Must be a date between|



**Commercial in confidence** 

**Page 7 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

|||||01/01/1980 and 31/12/2099|
|---|---|---|---|---|
|number_of_living_rooms|1|No|The number of living rooms in the rented<br>property.|Must be between 0 and 99|
|number_of_bedrooms|1|No|The number of bedrooms in the rented<br>property.|Must be between 0 and 99|
|furnished_status|furnished|No|The furnished status of the rented property. Supported values are:|The furnished status of the rented property. Supported values are:<br>●<br>furnished<br>●<br>part furnished<br>●<br>unfurnished<br>Must be one of: furnished,<br>part furnished or unfurnished.|
|rent_amount|999|No|Rent amount payable under the tenancy<br>agreement.|Must be between 0.00 and<br>999999.99|
|product_type|Managed|No|The product type you wish to use for this<br>protection.<br>●<br>Managed = standard deposit<br>protection<br>●<br>Let-Only or non-managed =<br>product type is only available<br>under the England & Wales<br>Insured scheme.|Supported values are:<br>●<br>let only<br>●<br>Managed<br>●<br>non-managed.<br>If blank, default to<br>"managed".|
|deposit_amount|1250.00|Yes|Deposit amount as per tenancy agreement.  Must be between 0.00 and|Deposit amount as per tenancy agreement.  Must be between 0.00 and<br>999999.99.|
|deposit_amount_to_protect|1250.00|Yes|Amount of deposit which will be protected<br>with TDS Custodial initially, cannot be more<br>than the deposit amount.|Must be between 0.00 and<br>999999.99.|
|deposit_received_date|31/10/2016|Yes|Date that the deposit was received by the<br>Agent or Landlord|DD-MM-YYYY:<br>Must be a date between<br>01/01/1980 and 31/12/2099.|
|number_of_tenants|1|Yes|Total number of tenants listed on tenancy<br>agreement. This count must also include<br>any related parties. Therefore if there are<br>three tenants and two related parties,<br>number_of_tenants should be set to 5.|Must be between 1 and 99|
|number_of_landlords|1|Yes|Total number of landlords listed on tenancy<br>agreement.|Must be between 1 and 9.|



**Person object** 

**Commercial in confidence** 

**Page 8 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

Each person associated with a deposit is defined in a separate object which are collectively provided to the API as an array of objects. 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|person_classification|Lead Tenant Yes|Lead Tenant Yes|This field is used to classify the type of party<br>associated with the deposit protection.|Supported values are:<br>●<br>Primary Landlord<br>●<br>Joint Landlord<br>●<br>Lead Tenant<br>●<br>Joint Tenant<br>●<br>Related Party|
|person _id|123456|No|If the “person_id” already exists within the TDS<br>Custodial system you can provide their ID here to<br>ensure the deposit is associated with the existing<br>record.<br>**Note:**all other details provided must match the<br>existing record too.|Existing person ID (1 - 100<br>alphanumeric characters)|
|person_reference|LL123ABZ|No|A user given reference for this person (only used<br>where person type is landlord).|Must be between 1 and 30<br>alphanumeric characters.|
|person _title|Mr|Yes|Title of the person e.g. Mr, Mrs, Miss, etc.|Must be between 1 and 30<br>characters.|
|person _firstname|James|Yes|First name of the person.|Must be between 1 and 255<br>characters.|
|person _surname|Calder|Yes|Surname of the person.|Must be between 1 and 255<br>characters.|
|is_business|N|Yes = in NI<br>No = in<br>other schemes|Where you can denote if this “person” is a business.  Must Y or N.|Where you can denote if this “person” is a business.  Must Y or N.|
|business_name|Tenant Ltd|Where<br>'is_business' is Y,<br>otherwise N|The name of the business is mandatory where<br>“is_business” = Y|Must be between 1 and 100<br>alphanumeric characters.|
|person _paon|1<br>or<br>The Dispute<br>Service|The Dispute<br>No - Tenant(s)<br>Yes - Landlords|This is only required for the landlord address.<br>This is the “building name” or “building name” of the<br>rented property.<br>In essence the house number or name.|Must be between 1 and 100<br>alphanumeric characters.|
|person _saon|Unit 5<br>or<br>The<br>West<br>Wing|West<br>No|This isonly requiredwhen the ”building name” or<br>“building number” (person_paon) is insufficient for<br>example 'The West Wing'.|Must be between 1 and 100<br>alphanumeric characters.|
|person _street|Maylands<br>Avenue|No - Tenant(s)<br>Yes - Landlord(s)|Street where property is located.<br>Required for landlord address only.|Must be between 1 and 100<br>alphanumeric characters.|
|person _locality|Little Village No|Little Village No|Locality where property is located.<br>Required for landlord address only.|Must be between 3 and 100<br>alphanumeric characters.|
|person_town|Hemel<br>Hempstead|No - Tenant(s)<br>Yes - Landlord(s)|Town where property is located.<br>Required for landlord address only.|Must be between 3 and 100<br>alphanumeric characters.|



**Commercial in confidence** 

**Page 9 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

|||||Tenancy Deposit Scheme<br>PCustodial|
|---|---|---|---|---|
|person<br>_administrative_area|Hertfordshire No - Tenant(s)|Hertfordshire No - Tenant(s)<br>Yes - Landlord(s)|Administrative area where property is located.<br>Required for landlord address only.|Must be between 3 and 100<br>alphanumeric characters.|
|person _postcode|HP 2 7TG|No - Tenant(s)<br>Yes - Landlord(s)|Postcode of tenancy property.<br>Required for landlord address only.|Must be between 1 and 8<br>characters.|
|person _country|United<br>Kingdom|No - Tenant(s)<br>Yes - Landlord(s)|Country where landlord lives.<br>Required for landlord address only.|Must be between 1 and 100<br>alphanumeric characters.|
|person _phone|01442<br>217000|No|Phone number of person.<br>This is required, if the scheme needs to contact the<br>person for any reason and do not have an email<br>address.|This is required, if the scheme needs to contact the<br>person for any reason and do not have an email<br>Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.<br>If the mobile number is<br>non-UK<br>include<br>the<br>international dialling codes.|
|person _fax|01442<br>236654|No|Fax number of the landlord, used if the scheme needs<br>to contact the landlord for any reason.<br>Required for landlord(s) only.|Fax number of the landlord, used if the scheme needs<br>Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.<br>If the mobile number is<br>non-UK<br>include<br>the<br>international dialling codes.|
|person _email|tenant1@<br>gmail.com|Yes|E-mail address of the person.<br>This is required, if the scheme needs to contact the<br>person for any reason.<br>This is the primary contact method used by the<br>scheme.<br>Where person type is**tenant - either mobile or**<br>**email are mandatory, not both**.|This is required, if the scheme needs to contact the<br>This is the primary contact method used by the<br>**tenant - either mobile or**<br>Must be between 1 to 255<br>characters and a valid email<br>address.<br>Must be unique, 2 parties<br>within the same tenancy<br>cannot<br>share<br>an<br>email<br>address.<br>A landlord cannot use the<br>same email address as an<br>existing tenant within the<br>TDS system.|
|person _mobile|07717<br>123456|Yes|Mobile phone number of the person.<br>Required, if the scheme needs to contact the person<br>for any reason.<br>Where the “person” type is tenant -**either mobile**<br>**or e-mail are mandatory, not both.**|Required, if the scheme needs to contact the person<br>**either mobile**<br>Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.<br>If the mobile number is<br>non-UK<br>include<br>the<br>international dialling codes.|
|correspondence_paon|1<br>or<br>The<br>Corner<br>House|Corner<br>No|This is the “building name” or “building name” for<br>the correspondence address.<br>In essence the house number or name.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction, this is required by the NI  scheme.|Must be between 1 and 100<br>alphanumeric characters.|
|correspondence_saon|Flat 2|No|This isonly requiredwhen the ”building name” or|when the ”building name” or<br>Must be between 1 and 100|



**Commercial in confidence** 

**Page 10 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

||or<br>Room 2||“building number” (person_paon) is insufficient for<br>example 'Flat 2”'.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction, this is required by the NI  scheme.|“building number” (person_paon) is insufficient for<br>alphanumeric characters.|
|---|---|---|---|---|
|correspondence_street|High Street|No|Street where property is located.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction this is required by the NI  scheme.|Must be between 1 and 100<br>alphanumeric characters.|
|correspondence_town|Little Village No|Little Village No|Locality where property is located.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction this is required by the NI  scheme.|Must be between 3 and 100<br>alphanumeric characters.|
|correspondence_locality|Wigan|No|Town where property is located.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction this is required by the NI  scheme.|Must be between 3 and 100<br>alphanumeric characters.|
|correspondence_administr<br>ative area|Lancashire|No|Administrative area where property is located.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction this is required by the NI  scheme.|Must be between 3 and 100<br>alphanumeric characters.|
|correspondence_postcode TT11CC|correspondence_postcode TT11CC|No|Postcode of tenancy property.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction this is required by the NI  scheme.|If landlord address is not within the necessary<br>Must be between 1 and 8<br>characters.|
|correspondence_country|United<br>Kingdom|No|Country where correspondence address is.<br>Applies to both tenant(s) and landlord(s)<br>If landlord address is not within the necessary<br>jurisdiction this is required by the NI  scheme.|Must be between 1 and 100<br>alphanumeric characters.|



## **Example request:** 

**Commercial in confidence** 

**Page 11 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

The overall abridged data structure is indicated below: 

`{ "member_id":"18881", "branch_id":"20001", "api_key":"ABCDE-12345-FGHIJ-67890-KLMNO” "region":"EW” "scheme_type": "Custodial", "tenancy":[ "user_tenancy_reference":"1", "property_id":1, "property_paon":"1", "property_saon":"", "property_street":"Test Street", …. "number_of_tenants":1, "number_of_landlords":1, "people":[{ "person_classification":"Lead Tenant", "person_id":"", "person_reference":"", "person_title":"Mr", "person_firstname":"Lead", "person_surame":"Tenant", "is_business":"N", …. "person_correspondence_country":"United Kingdom" },{ "person_classification":"Primary Landlord", "person_id":"", "person_reference":"", "person_title":"Miss", "person_firstname":"Primary", "person_surame":"Landlord", "is_business":"N", …. "person_correspondence_country":"United Kingdom" }] },{ "property_id":2, "property_paon":"2", …. "number_of_landlords":1, "people":[{ "person_classification":"Lead Tenant", …. "person_correspondence_country":"United Kingdom" },{ "person_classification":"Primary Landlord", …. "person_correspondence_country":"United Kingdom" }] }] }` 

**Commercial in confidence** 

**Page 12 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Response** 

When a tenancy creation request as defined above is submitted the service will return a response with the following information. 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|success|true|Yes|“true” -  if successfully submitted for processing by the deposit<br>creation engine.<br>“false”-  if an error was detected in the initial request.<br>**Note:**This flag only reports the success of the request and in no<br>way indicates that the creation of the deposit protection.<br>This informationcan only be determined with a follow-up call to the<br>CreationStatus service, detailed below.|
|batch_id|167237|No|If success = “true” and the requested deposit has been posted for<br>creation this will return the “**unique id”**for this request.<br>This reference is required for all subsequent API calls to the<br>CreationStatus service, in order to determine the outcome of the<br>deposit creation process.|
|error|Fail|No|If success = “false” this returns a text representation of the pre-<br>processing error that prevented the deposit creation from being<br>submitted|



## **Example responses:** 

|{||
|---|---|
|"batch_id":"167237",|"batch_id":"167237",|
|"success":"true"|"success":"true"|
|}||
|{||
|"error":"Invalid authentication key",|"error":"Invalid authentication key",|
|"success":"false"|"success":"false"|
|}||



## **400 Bad Request** 

`{  "errors":"Invalid JSON", "success":"false" }` 

## **403 Forbidden** 

`{  "errors":"Failed authentication", "success":"false" } { "success":"false" }` 

**Commercial in confidence** 

**Page 13 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

Success false with no error message indicates that the tenancy creation process was unsuccessful. 

## **3.1 Creation status** 

If there are no problems with the “deposit creation” request, then the deposit will be registered under the **Registered (not paid)** status and appear in the portal within a short period of time. 

API calls to the “CreationStatus” service provides information on the status of the “deposit creation” service and retrieve information about any errors that have occurred in processing the request. 

## **Request** 

This service is a GET request of the following form: 

## **`GET /CreateDepositStatus/<member_id>/<branch_id>/<api_key>/<batch_id>`** 

## **For example:** 

## **`GET /CreateDepositStatus/123456/0/12345-67890-ABCDE-FGHIJ/167237`** 

## **Response** 

When a deposit creation request is successful, a response object with the success status = true, is returned. This means that the api request to retrieve the state was successful. 

If the success status = false, then the response object will include an error key which will provide a reason for the failure, such as bad authentication credentials for the api_reference provided. 

The status element indicates whether the deposit creation request is still awaiting processing, has been successful or failed for some reason. This can be one of three values; 

- pending 

- created 

- failed 

For successful deposit creation items a “dan” element is returned, which will provide the identification reference for the newly created deposit. DAN stands for  ‘deposit account number’ and is the unique reference given to a deposit by TDS once created. 

For “failed” statuses an error array is returned and include an element for each field that generated an error. The key is the field name and the value is the error string. 

A successful creation plus error key can also return a warnings array, issues for consideration, but which would not in themselves cause the deposit not to be created. 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|success|true|Yes|success = true, if the request has been (successfully) submitted to the deposit creation engine<br>success = false, if an error was detected in the deposit creation request.<br>**Note:**This flag only reports the success of the request and in no way indicates that the<br>deposit protection has been created.|
|status|created|Yes|Supported values are:<br>●<br>created<br>●<br>failed<br>●<br>pending|



**Commercial in confidence** 

**Page 14 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

|dan|NI0000123|No|Unique reference for a deposit protection.<br>If the status is “pending” or “failed” the dan key will be blank/empty.|
|---|---|---|---|
|branch_id|123456|No|If the tenancy was created successfully then this will contain the branch_id for this tenancy.<br>This is required when a branch_id of -1 was supplied in the create call and a new branch has<br>been created automatically as part of the processing.|
|warnings|array|No|An array of field: reason elements if any warnings were issued.<br>Warnings are for information only and will not prevent a deposit from being created.<br>This is not present on pending status and optional for “created” and “failed” statuses|
|errors|array|No|An array of field: reason elements if any errors found.<br>The status will be failed and errors will be present.<br>This element will not be present for “created” and “pending” statuses.|



**Examples:** `{ "success":"true", "status":"created", "dan":"NI0000123", "branch_id":"123456", "warnings":[{ "postcode":"must conform to BS7666:2000" }] } { "batch_id":"1046279", "success":"true", "status":"pending", } { "batch_id":"1046729", "success":"true", "status":"failed", "errors": [ { "name": "Validation", "value": "Attempt to update an existing tenancy" } ] } { "batch_id": "1033777", "success": true, "status": "failed", "dan": "", "errors": [ { "code": "302110", "name": "number_of_tenants", "value": "should match the number of tenants", } ] }` 

**Commercial in confidence** 

**Page 15 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

`{ "batch_id": "1033783", "success": true, "status": "Failed", "dan": "", "errors": [ { "name": "postcode", "field": "person_postcode", "value": "must be from 1 to 8 alphanumeric characters", "code": "302111", } ], "warnings": [ { "name": "postcode", "field": "person_postcode", "value": "should conform to the format specified by BS7666:2000 within the UK; please specify a country for addresses outside the UK", } ] }` 

**Commercial in confidence** 

**Page 16 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **4 Tenancy information** 

This service will provide summary information about the deposit throughout the deposit lifecycle. Typically deposits will progress through a number of key defined states which will vary by scheme. 

The table below defines each of these states: 

## **Request** 

This service is a GET request of the following form: 

**`GET /TenancyInformation/<member_id>/<branch_id>/<api_key>/<dan>`** 

## **For example:** 

## **`GET /tenancy_information/123456/456789/12345-67890-ABCDE-FGHIJ/EW0232232`** 

## **Response** 

The response object will return a success element = true, if the request was successful, i.e. the member, branch and api-key match and own the requested DAN. 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|success|true|Yes|success = true, if the request has been (successfully) submitted to<br>the deposit creation engine<br>success = false, if an error was detected in the deposit creation<br>request.<br>**Note:**This flag only reports the success of the request and in no way<br>indicates that the deposit has been created.|
|dan|NI0000123|No|The unique reference of the deposit. This will be the same as the<br>reference requested in the call|
|status|Deposit Held / Deposit<br>Closed - deposit repaid<br>in full|Yes|The status of the deposit protection.|
|case_status|Repayment requested -<br>tenant / Awaiting<br>Tenant evidence|No|If there is a case open relating to this deposit, the status of the case<br>is returned. This could be a<br>●<br>repayment request<br>●<br>dispute<br>●<br>deposit transfer<br>●<br>tenant changeover|
|adjudication_decision<br>_published|Y/N|No|Where an adjudication report has been written relating to a dispute<br>over the queried deposit, this field will detail return Y, otherwise N.|
|protected _amount|1000.00|Yes|The amount of deposit currently protected by the scheme|
|warnings|array|No|An array of field:reason elements if any warnings were issued.<br>Warnings are for information only|
|errors|array|No|An array of field:reason elements if any errors found.|



**Commercial in confidence** 

**Page 17 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Examples:** 

`{ "success":"true", "status":"Deposit Held", "case_status":"Repayment Requested - Tenant", "dan":"NI0000123" } { "success":"false", "dan":"NI0000123" "errors":[{ "Invalid DAN":"DAN not associated with this member" }] }` 

**Commercial in confidence** 

**Page 18 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **5 Landlords** 

This service will provide search capabilities for existing non-member landlords associated with a member. 

## **Request** 

This service is a GET request of the following form: 

**`GET /landlord/<member_id>/<branch_id>/<api_key>/?filter_parameters`** 

## **For example:** 

**`GET /tenancy_information/123456/456789/12345-67890-ABCDE-FGHIJ/?id=123456`** 

## **Filter Parameters** 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|id|123456|No|Returns the Landlord details associated with the supplied ID.|
|email|test@exam<br>ple.com|No|Search for landlord by email address|
|limit|25|No|Maximum number of results to return, defaults to 50 if not supplied|
|after_id|123456|No|If more results are returned than the specified limit the after ID can be used to fetch the next<br>batch of results. The after id is the last id returned in the result batch.|



The response object will return a success element = true, if the request was successful, i.e. the member, branch and api-key match and own the requested landlord. 

## **Result** 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|success|true|Yes|success = true, if the request has been (successfully) processed.|
|errors|invalid_limit|No|key values for error and error message.|
|totalrResults|50|No|Total number of results returned in the request batch|
|landlords|See landlord entity|No|An array of landlord objects|



**Commercial in confidence** 

**Page 19 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Landlord Entity** 

|**Key**|**Example**|**Description**|**Data**<br>**Type**|
|---|---|---|---|
|nonmemberlandlordid|123456|The unique ID for this landlord|Int|
|organisationname|Test Organisation|key values for error and error message.|String|
|tradingname|Trading name|Company trading name|String|
|companyregisteredname|Registered name|Company registered name|String|
|companyregistrationnumber|REG1234|Company registration number|String|
|telephone|012345678910|Primary contact telephone number|String|
|alttelephone|012345678910|Alternative contact telephone number|String|
|fax||Not used|String|
|addresslines|36A A Street|Address lines|String|
|addresscity|Hemel Hempstead|Address city|String|
|addresscounty|Hertfordshire|Address county|String|
|addresspostcode|HP2 7TG|Address postcode|String|
|addresscountry|United Kingdom|Address country|String|
|branchname|Associated Branch|Associated branch name|String|
|branchid|123456|Unique id of the branch|Int|
|archivestatus|Active|Flag to determin if the landlord has been archived|String|
|email|email@example.com|Email address associated with landlord|String|
|correspondenceaddresslines|36A A Street|Correspondence address lines|String|
|correspondenceaddresscity|Hemel Hempstead|Correspondence address city|String|
|correspondenceaddresscounty|Hertfordshire|Correspondence address county|String|
|correspondenceaddresspostcode|HP2 7TG|Correspondence address postcode|String|
|correspondenceaddresscountry|United Kingdom|Correspondence address country|String|
|correspondencetelephone|012345678910|Correspondence telephone number|String|
|ca_is_diff_from_add|No|Flag determining if Correspondence address is<br>different from primary address, (Yes / No)|String|
|live_deposits|5|Number of live deposits associated with this landlord|Int|
|honorific|Miss|Landlord title|String|
|first_name|Helen|Landlord first name|String|
|last_name|Tester|Landlord last name|String|
|updated|Nov 9, 2020 2:27:48<br>PM|Record last updated date time|String|



**Commercial in confidence** 

**Page 20 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

|refreshed|Nov 9, 2020 2:27:48<br>PM|Record data source last refreshed|String|
|---|---|---|---|
|is_organisation|No|Flag determining if the landlord is an organisation<br>(Yes/No)|String|
|has_current_dpc|0|Not used|Int|
|nonmembertype|Landlord|Non member entity type|String|



## **Successful Result Example** 

`{ "totalResults": 1, "landlords": [ { "nonmemberlandlordid": 123456, "organisationname": "Miss Helen Tester", "tradingname": "", "companyregisteredname": "", "companyregistrationnumber": "", "telephone": "01234678910", "alttelephone": "", "fax": "", "addresslines": "36A A Street", "addresscity": "Hemel Hempstead", "addresscounty": "Hertfordshire", "addresspostcode": "HP2 7TG", "addresscountry": "United Kingdom", "branchname": "Associated branch", "branchid": 123456, "archivestatus": "active", "email": "email@example.com", "correspondenceaddresslines": "", "correspondenceaddresscity": "", "correspondenceaddresscounty": "", "correspondenceaddresspostcode": "", "correspondenceaddresscountry": "", "correspondencetelephone": "", "ca_is_diff_from_add": "No", "live_deposits": 0, "honorific": "Miss", "first_name": "Helen", "last_name": "Tester", "updated": "Nov 9, 2020 2:27:48 PM", "refreshed": "Nov 9, 2020 2:29:18 PM", "is_organisation": "No", "has_current_dpc": 0, "nonmembertype": "Landlord" } ], "isSuccess": true }` 

**Commercial in confidence** 

**Page 21 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Error Examples** 

## **400 Bad Request:** 

`{ "success":"false" "errors":[{ "invalid_limit":"The value supplied for limit is invalid" }] } { "success":"false" "errors":[{ "invalid_after_id":"The value supplied for after_id is invalid, must be numeric." }] } { "success":"false" "errors":[{ "id":"The value supplied for id is invalid, must be numeric." }] } { "success":"false" "errors":[{ "api_key":"no API key supplied", "member_id":"no member id supplied", "branch_id":"no branch id supplied" }] }` 

## **403 Forbidden:** 

`{ "success":"false" "errors":[{ "authentication_error":"The request could not be authenticated with the credentials supplied" }] } { "success":"false" "errors":[{ "authentication_error":"The request could not be authenticated." }] }` 

**Commercial in confidence** 

**Page 22 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **6 Properties** 

This service will provide search capabilities for existing properties associated with a member. 

## **Request** 

This service is a GET request of the following form: 

**`GET /property/<member_id>/<branch_id>/<api_key>/?filter_parameters`** 

## **For example:** 

**`GET /property/123456/456789/12345-67890-ABCDE-FGHIJ/?id=123456`** 

## **Filter Parameters** 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|id|123456|No|Returns the property details associated with the supplied ID.|
|postcode|HP2 7TG|No|Search for property by postcode|
|limit|25|No|Maximum number of results to return, defaults to 50 if not supplied|
|after_id|123456|No|If more results are returned than the specified limit the after ID can be used to fetch the next<br>batch of results. The after id is the last id returned in the result batch.|



The response object will return a success element = true, if the request was successful, i.e. the member, branch and api-key match and own the requested property. 

## **Result** 

|**Key**|**Example**|**Mandatory**|**Description**|
|---|---|---|---|
|success|true|Yes|success = true, if the request has been (successfully) processed.|
|errors|invalid_limit|No|key values for error and error message.|
|totalResults|50|No|Total number of results returned in the request batch|
|properties|See property entity|No|An array of property objects|



**Commercial in confidence** 

**Page 23 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Property Entity** 

|**Key**|**Example**|**Description**|**Data**<br>**Type**|
|---|---|---|---|
|propertyid|123456|The unique ID for this property|Int|
|organisationname|88 Test Street, Hemel Hempstead<br>HP2 7TG||String|
|propertynumber|88|The number|String|
|addresslines|Test Street|Address lines|String|
|addresscity|Hemel Hempstead|Address city|String|
|addresscounty|Hertfordshire|Address county|String|
|addresspostcode|HP2 7TG|Address postcode|String|
|addresscountry|United Kingdom|Address country|String|
|hmostatus|||String|
|localauthorityname|||String|
|localauthorityidentifier|||String|
|memberid|123456|Member id associated with property record|Int|
|membername|Test Company|Name of the associated member|String|
|branchid|123456|Id of the associated branch or 0.|Int|
|nonmemberid|123465|Non member landlord id associated with<br>property|Int|
|nonmembername|Mr Test Landlord|Nonmember landlord name|String|
|lockversion|10|Current version of record, not used|Int|
|archivestatus|Active|Flag determining if the property is active or<br>achived|String|
|numberofbedrooms|4|Number of bedrooms in the property|Int|
|numberoflivingrooms|1|Number of living rooms in the property|Int|
|furnishedstate|Furnished|The furnished status of the property|String|
|live_deposits|4|Number of deposits associated with the<br>property|String|
|updated|Nov 9, 2020 2:27:48 PM|Record last updated date time|String|
|refreshed|Nov 9, 2020 2:27:48 PM|Record data source last refreshed|String|
|has_current_dpc|0|Not used|Int|
|district|Norwich District||String|



**Commercial in confidence** 

**Page 24 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Successful Result Example** 

`{ "totalResults": 1, "properties": [ { "propertyid": 123456", "organisationname": "88 Test Street, Hemel Hempstead HP2 7TG ", "propertynumber": "88", "addresslines": "Test Street", "addresscity": "Hemel Hempstead", "addresscounty": "Hertfordshire", "addresspostcode": "HP2 7TG", "addresscountry": "United Kingdom", "hmostatus": "", "localauthorityname": "", "localauthorityidentifier": "", "memberid": 123456, "membername": "Test company", "branchid": 0, "nonmemberid": 1234655, "nonmembername": "Mr Test Landlord", "lockversion": 0, "archivestatus": "active", "numberofbedrooms": 4, "numberoflivingrooms": 1, "furnishedstate": "", "live_deposits": 2, "updated": "Nov 12, 2018 2:46:50 PM", "refreshed": "Nov 14, 2018 2:33:55 PM", "has_current_dpc": 0, "district": "Norwich District (B)" } ], "isSuccess": true }` 

## **Error Examples** 

## **403 Forbidden:** 

`{ "success":"false" "errors":[{ "authentication_error":"The request could not be authenticated with the credentials supplied" }] } { "success":"false" "errors":[{ "authentication_error":"The request could not be authenticated." }] }` 

**Commercial in confidence** 

**Page 25 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

**400 Bad Request:** `{ "success":"false" "errors":[{ "invalid_limit":"The value supplied for limit is invalid" }] } { "success":"false" "errors":[{ "invalid_after_id":"The value supplied for after_id is invalid, must be numeric." }] } { "success":"false" "errors":[{ "id":"The value supplied for id is invalid, must be numeric." }] } { "success":"false" "errors":[{ "api_key":"no API key supplied", "member_id":"no member id supplied", "branch_id":"no branch id supplied" }] }` 

**Commercial in confidence** 

**Page 26 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **7 Repayment Request** 

This service will provide the ability to submit a repayment request against a deposit. 

## **Request** 

This service is a POST request with content type application/json 

## **`POST /RaiseRepaymentRequest/`** 

## **Body** 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|api_key|ABCDE-<br>12345-FGHIJ-<br>67890-KLMNO|67890-KLMNO<br>Yes|The unique secret API key assigned to the<br>Head office/branch used to authenticate<br>the call is valid for the member.||
|member_id|123456|Yes|The member_id as supplied by TDS<br>Custodial..|Must be 1 - 6 alphanumeric<br>characters|
|branch_id|654321|Yes|The branch_id as supplied by TDS<br>Custodial.<br>For single branch members, the branch ID<br>is 0.<br>Members that have more than one branch<br>will always have differing branch and<br>member IDs.|Must be 1 - 6 alphanumeric<br>characters|
|dan|EW12345|Yes|The TDS custodial deposit identifier|EW12345|
|tenancy_end_date|26/05/2020|Yes|The date the tenancy ended.|Date string dd/mm/yyyy|
|tenant_repayment|999.99|Yes|Total repayment value to the tenant(s)|Numeric|
|tenant_repayment_type|Split|Yes|Split the tenant_repayment equally<br>between all tenants or repay the<br>tenant_repayment to the lead tenant.|Lead<br>Split|
|agent_repayment|JSON Object|Yes|See below|The member repayment<br>request and breakdown.|



## **Agent Repayment JSON Object** 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|total|458.48|Yes|The total proposed repayment amount to<br>the member, the following sub category<br>splits must add up to the supplied total.|Numeric|
|cleaning|200|Yes|Repayment amount allocated to cleaning.|Numeric|
|rent_arrears|0|Yes|Repayment amount allocated to rent<br>arrears|Numeric|
|damage|122.99|Yes|Repayment amount allocated to damage|Numeric|
|redecoration|0|Yes|Repayment amount allocated to<br>redecoration|Numeric|
|gardening|32.49|Yes|Repayment amount allocated to gardening|Numeric|
|other|99|Yes|Repayment amount allocated to other|Numeric|
|other_text|Description<br>text|No|Descriptive reason for allocating funds to<br>other. This field is mandatory when other is<br>greater than 0|The member repayment<br>request and breakdown.|



**Commercial in confidence** 

**Page 27 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Body JSON Example** 

`{ "api_key": "ABCDE-12345-FGHIJ-67890-KLMNO", "member_id": "123456", "branch_id": "123457", "dan": "EW12345", "tenancy_end_date": "26/05/2020", "tenant_repayment_type": "split", "tenant_repayment ": 999.99, "agent_repayment": { "total": 454.48, "cleaning": 200, "rent_arrears": 0, "damage": 122.99, "redecoration": 0, "gardening": 32.49, "other": 99, "other_text": "Description of other payment" } }` 

**Successful Result Example** 

**Key Example Type Description** success true boolean The repayment request was accepted ~~_—~~ 

`{ "success": true }` 

## **Error Response Examples** 

|**Key**|**Example**|**Type**|**Description**|
|---|---|---|---|
|success|false|boolean|The repayment request was accepted|
|errors|||key values pairs to identify the error(s)|



`{ "success":"false" "errors":{ "invalid_dan":"the DAN supplied could not be found " } } { "success":"false" "errors":{ "authentication_error":"The request could not be authenticated." } }` 

**Commercial in confidence** 

**Page 28 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

`{ "success":"false" "errors":{ "no_data":"no request JSON received" } } { "success":"false" "errors":{ "not_authorised ":"12345 is not authorised to manage EW12345" } } { "success":"false" "errors":{ "not_eligable ":"Tenancy is not in correct state to accept repayment request" } } { "success":"false" "errors":{ "tenant_split ":"Unable to calculate tenant repayment values" } } { "success":"false" "errors":{ "invalid_payment":"The repayment values do not match the expected deposit amount" } } { "success":"false" "errors":{ "failure":"The process did not complete successfully" } } { "success":"false" "errors":{ "api_key":"No API key supplied", "member_id":"No member id supplied", "dan":"No DAN was supplied", "tenancy_end_date":"No tenancy end date supplied", "tenant_repayment_type":"No tenant repayment type supplied" } } { "success":"false" "errors":{ "failure":"There is an existing case for this tenancy, the repayment request amounts do not match the proposal [EW12345]" } }` 

**Commercial in confidence** 

**Page 29 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **8 Deposit Protection Certificate** 

This service will provide a DPC PDF file download. 

## **Request** 

This service is a GET request of the following form: 

## **`GET /dpc/<member_id>/<branch_id>/<api_key>/<tenancy_dan>`** 

## **For example:** 

## **`GET /dpc/123456/456789/12345-67890-ABCDE-FGHIJ/EW123456`** 

## **Successful Result Example** 

PDF file download 

## **Error Response Examples** 

`{ "success":"false" "errors":{ "invalid_dan":"the DAN supplied could not be found " } } { "success":"false" "errors":{ "authentication_error":"The request could not be authenticated." } } { "success":"false" "errors":{ "no_data":"no request JSON received" } } { "success":"false" "errors":{ "not_authorised ":"12345 is not authorised to manage EW12345" } } { "success":"false" "errors":{ "error":"Sorry something went wrong with the request" }` 

**Commercial in confidence** 

**Page 30 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

`} { "success":"false" "errors":{ "not_found":"The DPC certificate could not be found" } } { "success":"false" "errors":{ "api_key":"No API key supplied", "member_id":"No member id supplied", "dan":"No DAN was supplied", } }` 

**Commercial in confidence** 

**Page 31 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **9 Create Head Office Branch** 

This service will create a new branch under the head office 

## **Request** 

This service is a PUT request of the following form: 

## **`PUT /headOffices/<head_office_member_id>/branches`** 

## **For example:** 

## **`PUT /headOffices/123456/branches`** 

## **Body** 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|api_key|ABCDE-<br>12345-FGHIJ-<br>67890-KLMNO|67890-KLMNO<br>Yes|The unique secret API key assigned to the<br>Head office/branch used to authenticate<br>the call is valid for the member.||
|branch|"branch" : {<br>...<br>}|Yes|The branch entity to create|JSON Object|



## **Branch Object** 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|branch_name|Branch One|Yes|The name of the branch|Min 3<br>Max 60<br>String - Alphanumeric|
|telephone|01234567890|Yes|Branch contact telephone|Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.|
|address_lines|Flat 3<br>36A Street Name|Yes|Address lines|Min 1<br>Max 100<br>String - Alphanumeric|
|address_town|Hemel<br>Hempstead|Yes|Town where branch is located|Min 1<br>Max 100<br>String - Alphanumeric|
|address_county|Hertfordshire|No|The county the branch is located|Min 1<br>Max 100<br>String - Alphanumeric|
|address_postcode|HP2 7TG|Yes|The post code where branch is located|Min 1<br>Max 10<br>Valid postcode format|
|address_country|United Kingdom|Yes|The country the branch is located|United Kingdom|
|email_general_correspondence general@branch.|email_general_correspondence general@branch.<br>com|Yes|Email for general correspondence|Min: 1<br>Max: 255<br>String - Valid email address<br>format|
|email_dispute_resolution|dispute@branch.<br>com|Yes|Email for dispute resolution contact|Min: 1<br>Max: 255<br>String - Valid email address<br>format|



**Commercial in confidence** 

**Page 32 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

|email_finance|finance@branch.<br>com|Yes|Email for finance contact|Min: 1<br>Max: 255<br>String - Valid email address<br>format|
|---|---|---|---|---|
|telephone_alt|01442 217000|No|Branch alternative telephone number|Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.|
|fax|01442 236654|No|Branch fax number|Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.|
|website|https://www.exa<br>mple.com/|No|Branch website|Min 3<br>Max 60<br>Alphanumeric|



## **Successful Result Example** 

|**Key**|**Example**|**Type**|**Description**|
|---|---|---|---|
|success|true|boolean|The branch was created|
|branchId|123456|integer|The created branch id|



`{ "branchId": 123456, "isSuccess": true }` 

## **Error Response Examples** 

`{ "isSuccess": false, "errors": { "authentication_error": "The request could not be authenticated with the credentials supplied" } }` { "isSuccess": false, "errors": { "malformed_json": "Invalid / unparsable JSON supplied" } } 

**Commercial in confidence** 

**Page 33 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

`{ "isSuccess": false, "errors": { "email_general_correspondence": "must be supplied", "email_email_finance": "must be supplied", "address_lines": "must be supplied", "address_country": "must be supplied", "branch_name": "must be supplied", "address_postcode": "must be supplied", "telephone": "must be supplied", "address_town": "must be supplied", "email_dispute_resolution": "must be supplied" } } { "isSuccess": false, "errors": { "email_general_correspondence": "format incorrect for field type", "address_country": "address_country value must be UNITED_KINGDOM", "telephone_alt": "format incorrect for field type", "email_finance": "format incorrect for field type", "address_postcode": "format incorrect for field type", "telephone": "format incorrect for field type", "fax": "format incorrect for field type", "email_dispute_resolution": "format incorrect for field type" } } { "isSuccess": false, "errors": { "email_general_correspondence": "length out of bounds", "address_county": "length out of bounds", "website": "length out of bounds", "address_lines": "length out of bounds", "branch_name": "length out of bounds", "telephone_alt": "length out of bounds", "email_finance": "length out of bounds", "telephone": "length out of bounds", "fax": "length out of bounds", "address_town": "length out of bounds", "email_dispute_resolution": "length out of bounds" } }` 

**Commercial in confidence** 

**Page 34 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **9 Create Head Office Branch User** 

This service will create a new user under the head office branch 

## **Request** 

This service is a PUT request of the following form: 

**`PUT /headOffices/<head_office_member_id>/branches/<branch_member_id>/users`** 

## **For example:** 

## **`PUT /headOffices/123456/branches/654321/users`** 

## **Body** 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|api_key|ABCDE-12345-FGHIJ-<br>67890-KLMNO|Yes|The unique secret API key assigned to the<br>Head office/branch used to authenticate<br>the call is valid for the member.||
|branch_user|"branch_user" : {<br>...<br>}|Yes|The user entity to create|JSON Object|



## **Branch User Object** 

|**Key**|**Example**|**Mandatory**|**Description**|**Format Definition**|
|---|---|---|---|---|
|job_title|Manager|No|Users job title|Min: 1<br>Max: 255<br>String - Alphanumeric|
|title|Mr|Yes|The honorific title of the user|Min 1<br>Max 60<br>Alphanumeric|
|first_name|John|Yes|First name of the user|Min 1<br>Max 255|
|last_name|Doe|Yes|Last name of the user|Min 1<br>Max 255|
|email|branch-<br>user@branch.<br>com|Yes|Email of the user|Min: 1<br>Max: 255<br>Valid email address.<br>Must be unique|
|telephone|01442 217000 No|01442 217000 No|Telephone of the user|Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.|
|telephone_mobile|07717 123456 No|07717 123456 No|Mobile phone number|Must start with a “0” or “+”<br>character.<br>Must be between 1 and 30<br>characters including area<br>codes.|



**Commercial in confidence** 

**Page 35 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

## **Successful Result Example** 

|**Key**|**Example**|**Type**|**Description**|
|---|---|---|---|
|success|true|boolean|The user was created|
|personId|123456|integer|The created person id|



`{ "personId": 123456, "isSuccess": true }` 

## **Error Response Examples** 

`{ "isSuccess": false, "errors": { "authentication_error": "The request could not be authenticated with the credentials supplied" } }` { "isSuccess": false, "errors": { "malformed_json": "Invalid / unparsable JSON supplied" } } { "isSuccess": false, "errors": { "last_name": "must be supplied", "title": "must be supplied", "first_name": "must be supplied", "email": "must be supplied" } } { "isSuccess": false, "errors": { "telephone_mobile": "format incorrect for field type", "telephone": "format incorrect for field type", "title": "format incorrect for field type", "email": "format incorrect for field type" } } { "isSuccess": false, "errors": { "telephone_mobile": "length out of bounds", 

**Commercial in confidence** 

**Page 36 of 37** 

Docusign Envelope ID: AF9297B2-1C37-8431-810A-C638AB3776F3 

"last_name": "length out of bounds", "telephone": "length out of bounds", "title": "length out of bounds", "first_name": "length out of bounds", "job_title": "length out of bounds", "email": "length out of bounds" } } 

**Commercial in confidence** 

**Page 37 of 37** 


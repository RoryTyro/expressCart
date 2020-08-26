const express = require('express');
const common = require('../common');
const { indexOrders } = require('../indexing');
const numeral = require('numeral');
const router = express.Router();
const uuidv4 = require('uuid/v4');
var request = require('request');
const tyroConfig = common.getPaymentConfig();

//Set up request variables
var baseURL = "https://test-tyro.mtf.gateway.mastercard.com"

var apiOperation = tyroConfig.paymentType;
var merchantId = tyroConfig.merchantId;
var mpgsVersionNumber = '56';
var basicAuth; //gonna have to make this dynamic



router.post('/checkout/payment', async (req, res, next) => {
    console.log("/payment request body is: " + JSON.stringify(req.body));
    console.log("sessionId is: " + JSON.stringify(req.body.sessionId));
    var sessionId = req.body.sessionId; //get from checkout_action POST
    var orderAmount = req.session.totalCartAmount;
    const db = req.app.db;
    const config = req.app.config;
    const tyroConfig = common.getPaymentConfig();
    var orderId = uuidv4();
    var transactionId = uuidv4();
  function completeUrl  (){
        var url = baseURL + "/api/rest/version/" + mpgsVersionNumber + "/merchant/" + merchantId + "/session" + "\n";
        console.log("url is: " + url);
        return url; 
        }

    var options = {
    
        'method': 'post',
        'url': completeUrl(),
        'headers': {
          'Content-Type': ['application/json', 'text/plain'],
          //plain TYRO_318 auth:
          //'Authorization': 'Basic bWVyY2hhbnQuVFlST18zMTg6ZTYyN2JjY2RlYmE1MTBjZDZiZTVmMDc0NWMzZjcwOTE=',
          //3ds TESTTYRO_3ds auth:
          'Authorization': 'Basic bWVyY2hhbnQuVEVTVFRZUk9fM0RTOjdmN2Q1OTMwY2Q3YTA1OTExNWI4MDUyNzRjZGU5MTg3',
          'Cookie': 'TS0183aa3c=01b18b28be7d366540b6a8c23d661f68db9c2de51f71a8090241eca92adb64fb1820877e8a985741489e8b521f5a42b409ce0a36f5'
        }
      };

      console.log("request details: " + JSON.stringify(options));
      let tyroResponse;
      request(options, function (error, response) { 
        if (error) {
            console.info(err.stack);
            req.session.messageType = 'danger';
            req.session.message = 'Your payment has declined. Please try again';
            req.session.paymentApproved = false;
            req.session.paymentDetails = '';
            res.redirect('/checkout/payment');
            return;
        }
        console.log(response.body);
        var tyroResponse = JSON.parse(response.body);
        console.log(tyroResponse);
           
       
    });


router.post('/checkout_action', async (req, res, next) => {
    console.log("checkout_action request body is: " + JSON.stringify(req.body));
    console.log("sessionId is: " + JSON.stringify(req.body.sessionId));
    var sessionId = req.body.sessionId; //get from checkout_action POST
    var orderAmount = req.session.totalCartAmount;
    const db = req.app.db;
    const config = req.app.config;
    const tyroConfig = common.getPaymentConfig();
    var orderId = uuidv4();
    var transactionId = uuidv4();
  function completeUrl  (){
        var url = baseURL + "/api/rest/version/" + mpgsVersionNumber + "/merchant/" + merchantId + "/order/" + orderId + "/transaction/" + transactionId + "\n";
        console.log("url is: " + url);
        return url; 
        }

    var options = {
    
        'method': 'PUT',
        'url': completeUrl(),
        'headers': {
          'Content-Type': ['application/json', 'text/plain'],
          //plain TYRO_318 auth:
          //'Authorization': 'Basic bWVyY2hhbnQuVFlST18zMTg6ZTYyN2JjY2RlYmE1MTBjZDZiZTVmMDc0NWMzZjcwOTE=',
          //3ds TESTTYRO_3ds auth:
          'Authorization': 'Basic bWVyY2hhbnQuVEVTVFRZUk9fM0RTOjdmN2Q1OTMwY2Q3YTA1OTExNWI4MDUyNzRjZGU5MTg3',
          'Cookie': 'TS0183aa3c=01b18b28be7d366540b6a8c23d661f68db9c2de51f71a8090241eca92adb64fb1820877e8a985741489e8b521f5a42b409ce0a36f5'
        },
        body: JSON.stringify({apiOperation: apiOperation, order:{amount: orderAmount, currency:"AUD"},session:{id:sessionId},sourceOfFunds:{type:"CARD"}})
      };

      console.log("request details: " + JSON.stringify(options));
      let tyroResponse;
      request(options, function (error, response) { 
        if (error) {
            console.info(err.stack);
            req.session.messageType = 'danger';
            req.session.message = 'Your payment has declined. Please try again';
            req.session.paymentApproved = false;
            req.session.paymentDetails = '';
            res.redirect('/checkout/payment');
            return;
        }
        console.log(response.body);
        var tyroResponse = JSON.parse(response.body);
        console.log(tyroResponse);
    
       // Update response
       let paymentStatus = 'Paid';
       if(tyroResponse && tyroResponse.response.acquirerCode !== 'APPROVED'){
           paymentStatus = 'Declined';
       }

       
           completeOrder(tyroResponse, paymentStatus);
       
    });

    function completeOrder(tyroResponse, paymentStatus){
    console.log("out of request response: " + tyroResponse);
           // new order doc
       const orderDoc = {
            _id: orderId,
           orderPaymentId: tyroResponse.transaction.receipt,
           orderPaymentGateway: 'Tyro',
           orderPaymentMessage: tyroResponse.transaction.authorizationCode,
           orderTotal: req.session.totalCartAmount,
           orderShipping: req.session.totalCartShipping,
           orderItemCount: req.session.totalCartItems,
           orderProductCount: req.session.totalCartProducts,
           orderCustomer: common.getId(req.session.customerId),
           orderEmail: req.session.customerEmail,
           orderCompany: req.session.customerCompany,
           orderFirstname: req.session.customerFirstname,
           orderLastname: req.session.customerLastname,
           orderAddr1: req.session.customerAddress1,
           orderAddr2: req.session.customerAddress2,
           orderCountry: req.session.customerCountry,
           orderState: req.session.customerState,
           orderPostcode: req.session.customerPostcode,
           orderPhoneNumber: req.session.customerPhone,
           orderComment: req.session.orderComment,
           orderStatus: paymentStatus,
           orderDate: new Date(),
           orderProducts: req.session.cart,
           orderType: 'Single'
       };
        // insert order into DB

        const newOrder =  db.orders.insertOne(orderDoc);

        // get the new ID
        //const newId = newOrder.insertedId;

    



        console.log("paymentStatus: " + paymentStatus)
       // add to lunr index
       indexOrders(req.app)
       .then(() => {
           // Process the result
           if(paymentStatus === 'Paid'){
               
            console.log("Paid response is firing")
               // set the results
               req.session.messageType = 'success';
               req.session.message = 'Your payment was successfully completed';
               req.session.paymentEmailAddr = orderDoc.orderEmail;
               req.session.paymentApproved = true;
               req.session.paymentDetails = '<p><strong>Order ID: </strong>' + orderId + '</p><p><strong>Transaction ID: </strong>' + tyroResponse.response.acquirerCode + '</p>';
   
               // set payment results for email
               const paymentResults = {
                   message: req.session.message,
                   messageType: req.session.messageType,
                   paymentEmailAddr: req.session.paymentEmailAddr,
                   paymentApproved: true,
                   paymentDetails: req.session.paymentDetails
               };
   
               // clear the cart
               if(req.session.cart){
                   common.emptyCart(req, res, 'function');
               }
   
               // send the email with the response
               // TODO: Should fix this to properly handle result
             //  common.sendEmail(req.session.paymentEmailAddr, 'Your payment with ' + config.cartTitle, common.getEmailTemplate(paymentResults));
             res.redirect('/payment/' + orderId);
            }
           else{
            // redirect to failure
            req.session.messageType = 'danger';
            req.session.message = 'Your payment has declined. Please try again';
            req.session.paymentApproved = false;
            req.session.paymentDetails = '<p><strong>Order ID: </strong>' + orderId + '</p><p><strong>Transaction ID: </strong>' + tyroResponse.response.acquirerCode + '</p>';
            res.redirect('/payment/' + orderId);
           }

       });
    }


  
});



module.exports = router;

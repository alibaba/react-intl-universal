
/**
 * Currency code list
 * https://www.currency-iso.org/en/home/tables/table-a1.html
 */
const currency = ["AFN","EUR","ALL","DZD","USD","AOA","XCD","ARS","AMD","AWG","AUD","AZN","BSD","BHD","BDT","BBD","BYN","BZD","XOF","BMD","INR","BTN","BOB","BOV","BAM","BWP","NOK","BRL","BND","BGN","BIF","CVE","KHR","XAF","CAD","KYD","CLP","CLF","CNY","COP","COU","KMF","CDF","NZD","CRC","HRK","CUP","CUC","ANG","CZK","DKK","DJF","DOP","EGP","SVC","ERN","ETB","FKP","FJD","XPF","GMD","GEL","GHS","GIP","GTQ","GBP","GNF","GYD","HTG","HNL","HKD","HUF","ISK","IDR","XDR","IRR","IQD","ILS","JMD","JPY","JOD","KZT","KES","KPW","KRW","KWD","KGS","LAK","LBP","LSL","ZAR","LRD","LYD","CHF","MOP","MKD","MGA","MWK","MYR","MVR","MRO","MUR","XUA","MXN","MXV","MDL","MNT","MAD","MZN","MMK","NAD","NPR","NIO","NGN","OMR","PKR","PAB","PGK","PYG","PEN","PHP","PLN","QAR","RON","RUB","RWF","SHP","WST","STD","SAR","RSD","SCR","SLL","SGD","XSU","SBD","SOS","SSP","LKR","SDG","SRD","SZL","SEK","CHE","CHW","SYP","TWD","TJS","TZS","THB","TOP","TTD","TND","TRY","TMT","UGX","UAH","AED","USN","UYU","UYI","UZS","VUV","VEF","VND","YER","ZMW","ZWL","XBA","XBB","XBC","XBD","XTS","XXX","XAU","XPD","XPT","XAG"];

const numberFormat = {};

for (var i = 0; i < currency.length; i++) {
  numberFormat[currency[i]] = {
    style: 'currency',
    currency: currency[i]
  };
}

export const defaultFormats = {
  number: numberFormat
}

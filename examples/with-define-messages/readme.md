
#requirenments
 - npm install babel-plugin-react-intl -D 
 can't get why, but not allways all dev dependencies install, make sure to install all that listed in package.json
 (may have problems with package-lock.json)
 
 
 #commands 
 - npm run extract-intl 
 extracts all messages defiend with defineMessages to locales/ .json files
 
 - npm buld 
 build files to host
 
 - npm start 
 start webpack-dev-server
 
 
 
 #note
 - example written to show extract-intl command  usage with react-intl-universal and babel-plugin-react-intl
 - all loacles laded to memory but locale change requires page relaod for simplicity reason
 
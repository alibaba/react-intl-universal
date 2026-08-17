import intl from 'core/intl';

const util = {
  getMessage: () => intl.get('MESSAGE_NOT_IN_COMPONENT').d('react-intl-universal is able to internationalize message not in React.Component'),
};
 
export default util;

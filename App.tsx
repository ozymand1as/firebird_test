import {SafeAreaProvider} from 'react-native-safe-area-context';

import {App} from './src/app/App';

export default function FirebirdPostsApp() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

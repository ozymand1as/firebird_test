import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {PostDetailScreen} from '../screens/PostDetailScreen';
import {PostsScreen} from '../screens/PostsScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Posts">
        <Stack.Screen
          name="Posts"
          component={PostsScreen}
          options={{title: 'Posts'}}
        />
        <Stack.Screen
          name="PostDetail"
          component={PostDetailScreen}
          options={{title: 'Post details'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

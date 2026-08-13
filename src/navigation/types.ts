import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

/** Route parameters for the application's only navigator. */
export type RootStackParamList = {
  Posts: undefined;
  PostDetail: {postId: number};
};

export type PostsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Posts'>;
export type PostDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PostDetail'>;
export type PostDetailRouteProp = RouteProp<RootStackParamList, 'PostDetail'>;

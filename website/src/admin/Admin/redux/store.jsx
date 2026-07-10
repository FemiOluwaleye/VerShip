import { configureStore } from '@reduxjs/toolkit';
import userReducer from './UserSlice';
import lenderReducer from './DriverSlice';
import providerReducer from './ProviderSlice'



const store = configureStore({
  reducer: {
    users: userReducer,
    lenders: lenderReducer,
    providers: providerReducer,
  },
});

export default store;

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../Config";

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async ({ page = 1, limit = 10, search = "", dateFilter = "all" }) => {
    const response = await axiosInstance.get(
      `/userlist?page=${page}&limit=${limit}&search=${encodeURIComponent(
        search
      )}&dateFilter=${dateFilter}`
    );
    return {
      users: response.data.body.data,
      totalPages: response.data.body.totalPages,
    };
  }
);

export const deleteUser = createAsyncThunk("users/deleteUser", async (id) => {
  await axiosInstance.post(`/userDelete/${id}`);
  return id;
});

export const toggleUserStatus = createAsyncThunk(
  "users/toggleUserStatus",
  async ({ id, currentStatus }) => {
    const newStatus = currentStatus === "0" ? "1" : "0";
    const response = await axiosInstance.post("/userStatus", {
      id,
      status: newStatus,
    });
    return response.data.success
      ? { id, newStatus }
      : { id, newStatus: currentStatus };
  }
);

export const toggleUserBlock = createAsyncThunk(
  "users/toggleUserBlock",
  async ({ id, currentStatus }) => {
    const newStatus = currentStatus === "0" ? "1" : "0";
    const response = await axiosInstance.post("/blockstatus", {
      id,
      block: newStatus, 
    });
    return response.data.success
      ? { id, newStatus }
      : { id, newStatus: currentStatus };
  }
);

export const toggleUserSuspend = createAsyncThunk(
  "users/toggleUserSuspend",
  async ({ id, currentStatus }) => {
    const newStatus = currentStatus === "0" ? "1" : "0";
    const response = await axiosInstance.post("/suspendstatus", {
      id,
      suspend: newStatus, 
    });
    return response.data.success
      ? { id, newStatus }
      : { id, newStatus: currentStatus };
  }
);

const UserSlice = createSlice({
  name: "users",
  initialState: {
    users: [],
    error: null,
    loading: false,
    totalPages: 1,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.users && action.payload.totalPages !== undefined) {
          state.users = action.payload.users;
          state.totalPages = action.payload.totalPages;
        } else {
          state.users = [];
          state.totalPages = 1;
        }
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter((user) => user.id !== action.payload);
      })
      .addCase(toggleUserStatus.fulfilled, (state, action) => {
        const { id, newStatus } = action.payload;
        const user = state.users.find((user) => user.id === id);
        if (user) {
          user.status = newStatus;
        }
      })
      .addCase(toggleUserBlock.fulfilled, (state, action) => {
        const { id, newStatus } = action.payload;
        const user = state.users.find((user) => user.id === id);
        if (user) {
          user.block = newStatus; 
        }
      })
      .addCase(toggleUserSuspend.fulfilled, (state, action) => {
        const { id, newStatus } = action.payload;
        const user = state.users.find((user) => user.id === id);
        if (user) {
          user.suspend = newStatus; 
        }
      });
  },
});

export default UserSlice.reducer;
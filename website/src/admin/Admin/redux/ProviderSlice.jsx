import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../Config";

export const fetchProviders = createAsyncThunk(
  "providers/fetchProviders",
  async ({ page = 1, limit = 10, search = "", dateFilter = "all" }) => {
    const response = await axiosInstance.get(
      `/providers?page=${page}&limit=${limit}&search=${encodeURIComponent(
        search
      )}&dateFilter=${dateFilter}`
    );

    return {
      providers: response.data.body.data,
      totalPages: response.data.body.totalPages,
    };
  }
);

export const deleteProvider = createAsyncThunk(
  "providers/deleteProvider",
  async (id) => {
    await axiosInstance.delete(`/provider/${id}`);
    return id;
  }
);

export const toggleProviderStatus = createAsyncThunk(
  "providers/toggleProviderStatus",
  async ({ id, currentStatus }) => {
    const newStatus = currentStatus === "0" ? "1" : "0";
    const response = await axiosInstance.put("/provider/status", {
      id,
      status: newStatus,
    });

    return response.data.success
      ? { id, newStatus }
      : { id, newStatus: currentStatus };
  }
);

export const toggleProviderBlock = createAsyncThunk(
  "providers/toggleProviderBlock",
  async ({ id, currentStatus }) => {
    const newStatus = currentStatus === "0" ? "1" : "0";
    const response = await axiosInstance.put("/provider/block", {
      id,
      block: newStatus,
    });

    return response.data.success
      ? { id, newStatus }
      : { id, newStatus: currentStatus };
  }
);

export const toggleProviderSuspend = createAsyncThunk(
  "providers/toggleProviderSuspend",
  async ({ id, currentStatus }) => {
    const newStatus = currentStatus === "0" ? "1" : "0";
    const response = await axiosInstance.put("/provider/suspend", {
      id,
      suspend: newStatus,
    });

    return response.data.success
      ? { id, newStatus }
      : { id, newStatus: currentStatus };
  }
);

export const updateProviderDocumentVerify = createAsyncThunk(
  "providers/updateDocumentVerify",
  async ({ id, documentVerify }) => {
    await axiosInstance.put("/provider/document-verify", {
      id,
      documentVerify,
    });
    return { id, documentVerify };
  }
);

export const updateRanking = createAsyncThunk(
  "providers/updateRanking",
  async ({ id, ranking }) => {
    await axiosInstance.put("/provider/update-ranking", {
      id,
      ranking,
    });
    return { id, ranking };
  }
);


const ProviderSlice = createSlice({
  name: "providers",
  initialState: {
    providers: [],
    error: null,
    loading: false,
    totalPages: 1,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviders.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProviders.fulfilled, (state, action) => {
        state.loading = false;
        state.providers = action.payload.providers || [];
        state.totalPages = action.payload.totalPages || 1;
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      .addCase(deleteProvider.fulfilled, (state, action) => {
        state.providers = state.providers.filter(
          (provider) => provider.id !== action.payload
        );
      })

      .addCase(toggleProviderStatus.fulfilled, (state, action) => {
        const { id, newStatus } = action.payload;
        const provider = state.providers.find((p) => p.id === id);
        if (provider) provider.status = newStatus;
      })

      .addCase(toggleProviderBlock.fulfilled, (state, action) => {
        const { id, newStatus } = action.payload;
        const provider = state.providers.find((p) => p.id === id);
        if (provider) provider.block = newStatus;
      })

      .addCase(toggleProviderSuspend.fulfilled, (state, action) => {
        const { id, newStatus } = action.payload;
        const provider = state.providers.find((p) => p.id === id);
        if (provider) provider.suspend = newStatus;
      })

      .addCase(updateProviderDocumentVerify.fulfilled, (state, action) => {
        const { id, documentVerify } = action.payload;
        const provider = state.providers.find((p) => p.id === id);
        if (provider?.businessInfo) {
          provider.businessInfo.documentVerify = documentVerify;
        }
      })
      .addCase(updateRanking.fulfilled, (state, action) => {
        const { id, ranking } = action.payload;
        const provider = state.providers.find((p) => p.id === id);
        if (provider) provider.ranking = ranking;
      });

  },
});

export default ProviderSlice.reducer;

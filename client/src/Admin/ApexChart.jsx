import React, { useState, useEffect } from "react";
import ReactApexChart from "react-apexcharts";
import { axiosInstance } from "../Config";
import { toast, ToastContainer } from "react-toastify";

const ApexCharts = () => {
  const [series, setSeries] = useState([
    { name: "Users", data: [] },
    { name: "Providers", data: [] },
  ]);
  const [options, setOptions] = useState({
    chart: {
      height: 350,
      type: "bar",
      toolbar: {
        show: false,
      },
    },
    colors: ["#1E90FF", "#32CD32"],
    plotOptions: {
      bar: {
        borderRadius: 10,
        dataLabels: {
          position: "top",
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => (val === 0 ? "" : val),
      offsetY: -20,
      style: {
        fontSize: "12px",
        colors: ["#1E90FF", "#32CD32"],
      },
    },
    xaxis: {
      categories: [],
      position: "bottom",
      axisBorder: {
        show: true,
      },
      axisTicks: {
        show: false,
      },
      crosshairs: {
        fill: {
          type: "gradient",
          gradient: {
            colorFrom: "#D8E3F0",
            colorTo: "#BED1E6",
            stops: [0, 100],
            opacityFrom: 0.4,
            opacityTo: 0.5,
          },
        },
      },
      tooltip: {
        enabled: true,
      },
    },
    yaxis: {
      show: false,
      labels: {
        show: true,
        formatter: (val) => (val === 0 ? "" : val),
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosInstance.post(`/chartdata`);
        const { data, categories } = response.data;

        if (
          !Array.isArray(data.players) ||
          !Array.isArray(data.coaches) ||
          !Array.isArray(categories)
        ) {
          toast.error("Invalid data received.");
          return;
        }

        setSeries([
          { name: "Users", data: data.players },
          { name: "Providers", data: data.coaches },
        ]);

        setOptions((prevOptions) => ({
          ...prevOptions,
          xaxis: {
            ...prevOptions.xaxis,
            categories: categories || [],
          },
        }));
      } catch (error) {}
    };

    fetchData();
  }, []);

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
      />
      <div className="col-12">
        <div className="card card-statistics">
          <div className="card-header">
            <h4 className="card-title">Users & Providers Chart</h4>
          </div>
          <div className="card-body">
            <ReactApexChart
              options={options}
              series={series}
              type="bar"
              height={350}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default ApexCharts;

# Step 1: download chlorophyll for Algeria and print a short summary.
import os
import datetime
import copernicusmarine
import xarray as xr

DATASET_ID = "cmems_obs-oc_med_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D"
LON_MIN, LON_MAX = -3.0, 9.5   # west / east limits
LAT_MIN, LAT_MAX = 35.0, 38.0  # south / north limits
OUT_DIR = "data_raw"
OUT_FILE = "chl_test.nc"

# Login comes from GitHub secrets (never written in the code)
username = os.environ["COPERNICUS_USERNAME"]
password = os.environ["COPERNICUS_PASSWORD"]

today = datetime.date.today()
done = False
# The newest data can be 1-3 days late, so we try several end dates
for lag in [1, 2, 3, 5]:
    end = today - datetime.timedelta(days=lag)
    start = end - datetime.timedelta(days=6)
    try:
        copernicusmarine.subset(
            dataset_id=DATASET_ID,
            variables=["CHL"],
            minimum_longitude=LON_MIN, maximum_longitude=LON_MAX,
            minimum_latitude=LAT_MIN, maximum_latitude=LAT_MAX,
            start_datetime=f"{start}T00:00:00",
            end_datetime=f"{end}T00:00:00",
            output_directory=OUT_DIR,
            output_filename=OUT_FILE,
            username=username,
            password=password,
        )
        done = True
        break
    except Exception as e:
        print(f"Try with lag={lag} failed: {e}")

if not done:
    raise SystemExit("Download failed for all tries")

# Print a short summary of what we got
ds = xr.open_dataset(os.path.join(OUT_DIR, OUT_FILE))
chl = ds["CHL"]
print("Days downloaded:", [str(t)[:10] for t in ds["time"].values])
print("Grid size (time, lat, lon):", chl.shape)
print("CHL min / max:", float(chl.min()), float(chl.max()))

# Download chlorophyll for Algeria and save the newest day as a light JSON file.
import os
import json
import datetime
import numpy as np
import copernicusmarine
import xarray as xr

DATASET_ID = "cmems_obs-oc_med_bgc-plankton_nrt_l4-gapfree-multi-1km_P1D"
LON_MIN, LON_MAX = -3.0, 9.5
LAT_MIN, LAT_MAX = 35.0, 38.0
OUT_DIR = "data_raw"
OUT_FILE = "chl_test.nc"
STEP = 3  # keep 1 point out of 3 to make the file light

username = os.environ["COPERNICUS_USERNAME"]
password = os.environ["COPERNICUS_PASSWORD"]

today = datetime.date.today()
done = False
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

ds = xr.open_dataset(os.path.join(OUT_DIR, OUT_FILE))
chl = ds["CHL"]
tdim, ydim, xdim = chl.dims
print("Days downloaded:", [str(t)[:10] for t in ds[tdim].values])
print("CHL min / max:", float(chl.min()), float(chl.max()))

day = chl.isel({tdim: -1}).isel({ydim: slice(None, None, STEP), xdim: slice(None, None, STEP)})
date = str(ds[tdim].values[-1])[:10]
lats = [round(float(v), 4) for v in day[ydim].values]
lons = [round(float(v), 4) for v in day[xdim].values]
values = [[None if np.isnan(v) else round(float(v), 3) for v in row] for row in day.values]

os.makedirs("docs", exist_ok=True)
with open("docs/chl_latest.json", "w") as f:
    json.dump({"date": date, "lats": lats, "lons": lons, "values": values}, f)
print("Saved docs/chl_latest.json for", date)

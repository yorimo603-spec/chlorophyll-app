"""Previsions 72 h (temperature, courants, vagues) pour l'Algerie.
Ecrit le resultat dans docs/forecast_latest.json
"""
import os
import sys
import json
import datetime as dt

import numpy as np
import copernicusmarine as cm

USER = os.environ.get("COPERNICUS_USERNAME")
PASS = os.environ.get("COPERNICUS_PASSWORD")

# Zone : mer au large de l'Algerie
BOX = dict(
    minimum_longitude=-3.0,
    maximum_longitude=9.5,
    minimum_latitude=34.8,
    maximum_latitude=38.8,
)

HOURS = 72          # duree de la prevision
TIME_STEP = 3       # une valeur toutes les 3 heures
SPACE_STEP = 2      # une cellule sur 2 (pour garder un fichier leger)

now = dt.datetime.now(dt.timezone.utc).replace(minute=0, second=0, microsecond=0)
START = now.strftime("%Y-%m-%dT%H:%M:%S")
END = (now + dt.timedelta(hours=HOURS)).strftime("%Y-%m-%dT%H:%M:%S")

# nom de la couche -> (dataset, {nom dans le fichier JSON: variable Copernicus})
LAYERS = {
    "cur": (
        "cmems_mod_med_phy-cur_anfc_4.2km-2D_PT1H-m",
        {"u": "uo", "v": "vo"},
    ),
    "tem": (
        "cmems_mod_med_phy-tem_anfc_4.2km-2D_PT1H-m",
        {"sst": "thetao"},
    ),
    "wav": (
        "cmems_mod_med_wav_anfc_4.2km_PT1H-i",
        {"hs": "VHM0", "dir": "VMDR"},
    ),
}


def clean(a):
    """Arrondit et remplace les NaN (terre) par null."""
    a = np.round(np.asarray(a, dtype=float), 2)
    mask = np.isnan(a)
    out = a.astype(object)
    out[mask] = None
    return out.tolist()


def fetch_layer(dataset_id, variables):
    ds = cm.open_dataset(
        dataset_id=dataset_id,
        variables=list(variables.values()),
        start_datetime=START,
        end_datetime=END,
        username=USER,
        password=PASS,
        **BOX,
    )
    # s'il y a une dimension de profondeur, garder la surface
    if "depth" in ds.dims:
        ds = ds.isel(depth=0)
    ds = ds.isel(
        time=slice(0, None, TIME_STEP),
        latitude=slice(0, None, SPACE_STEP),
        longitude=slice(0, None, SPACE_STEP),
    ).load()

    layer = {
        "times": [str(t)[:19] + "Z" for t in ds["time"].values],
        "lats": [round(float(x), 4) for x in ds["latitude"].values],
        "lons": [round(float(x), 4) for x in ds["longitude"].values],
    }
    for key, var in variables.items():
        layer[key] = clean(ds[var].values)
    return layer


def main():
    if not USER or not PASS:
        print("ERREUR : COPERNICUS_USERNAME / COPERNICUS_PASSWORD manquants")
        sys.exit(1)

    result = {
        "generated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hours": HOURS,
        "layers": {},
    }
    errors = []
    for name, (dataset_id, variables) in LAYERS.items():
        try:
            print("Telechargement :", name, dataset_id)
            result["layers"][name] = fetch_layer(dataset_id, variables)
            print("OK :", name)
        except Exception as e:  # on continue avec les autres couches
            print("ECHEC :", name, repr(e))
            errors.append(name)

    if not result["layers"]:
        print("Aucune couche n'a pu etre telechargee")
        sys.exit(1)

    result["failed_layers"] = errors
    os.makedirs("docs", exist_ok=True)
    with open("docs/forecast_latest.json", "w") as f:
        json.dump(result, f, separators=(",", ":"))
    size = os.path.getsize("docs/forecast_latest.json") / 1e6
    print("Ecrit docs/forecast_latest.json (%.1f Mo)" % size)


if __name__ == "__main__":
    main()

name: Daily update
on:
  workflow_dispatch:
  schedule:
    - cron: "0 7 * * *"
permissions:
  contents: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install copernicusmarine xarray netcdf4 numpy
      - run: python backend/fetch_chl.py
        env:
          COPERNICUS_USERNAME: ${{ secrets.COPERNICUS_USERNAME }}
          COPERNICUS_PASSWORD: ${{ secrets.COPERNICUS_PASSWORD }}
      - name: Save result
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add docs/chl_latest.json
          git commit -m "Daily chlorophyll update" || echo "No changes"
          git push

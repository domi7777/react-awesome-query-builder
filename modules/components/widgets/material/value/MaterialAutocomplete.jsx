import React from "react";
import TextField from '@material-ui/core/TextField';
import {mapListValues, listValuesToArray, sleep} from "../../../../utils/stuff";
import FormControl from "@material-ui/core/FormControl";
import omit from "lodash/omit";
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import { nextTick } from "process";



//.... work with server
//  throttle, cancel last fetch
//  initial values can be undefined until search

//  value as obj ???    is re-render that bad ?
//  after F5
//  humanStringFormat

//  showSearch should use Autocomplete implicitly for end user
//release: doc async, fetch

//  multi
//  groupBy
//  i18n load more

const defaultFilterOptions = createFilterOptions();

const simulateAsyncFetch = (all, pageSize = 0, delay = 1000) => async (search, offset, _meta) => {
  const filtered = listValuesToArray(all)
    .filter(({title}) => search == null ? true : title.indexOf(search) != -1);
  const pages = pageSize ? Math.ceil(filtered.length / pageSize) : 0;
  const currentOffset = offset || 0;
  const currentPage = pageSize ? Math.ceil(currentOffset / pageSize) : null;
  const values = pageSize ? filtered.slice(currentOffset, currentOffset + pageSize) : filtered;
  const newOffset = pageSize ? currentOffset + values.length : null;
  const hasMore = pageSize ? (newOffset < filtered.length) : false;
  // console.debug('simulateAsyncFetch', {
  //   search, offset, values, hasMore, filtered
  // });
  await sleep(delay);
  return {
    values,
    hasMore
  };
};

const mergeListValues = (values, newValues, toStart = false) => {
  if (!newValues)
    return values;
  const old = values ? listValuesToArray(values) : [];
  const newFiltered = newValues.filter(v => old.find(av => av.value == v.value) == undefined);
  const merged = toStart ? [...newFiltered, ...old] : [...old, ...newFiltered];
  return merged;
};

const listValueToOption = (lv) => {
  if (lv == null) return null;
  const {title, value} = lv;
  return {title, value};
};

const getListValue = (selectedValue, listValues) => 
  mapListValues(listValues, (lv) => (lv.value === selectedValue ? lv : null))
  .filter(v => v !== null)
  .shift();



export default ({
  asyncListValues: selectedAsyncListValues, 
  listValues: staticListValues, allowCustomValues,
  value: selectedValue, setValue, placeholder, customProps, readonly, config
}) => {
  // setings
  const {defaultSliderWidth} = config.settings;
  const {width, ...rest} = customProps || {};
  const customInputProps = rest.input || {};
  const customAutocompleteProps = omit(rest.autocomplete || rest, ["showSearch"]);
  const loadMoreTitle = `Load more...`;

  //todo: configurable
  const demoAll = [
    {title: 'A', value: 'a'},
    {title: 'AAA', value: 'aaa'},
    {title: 'B', value: 'b'},
    {title: 'C', value: 'c'},
    {title: 'D', value: 'd'},
    {title: 'E', value: 'e'},
    {title: 'F', value: 'f'},
    {title: 'G', value: 'g'},
    {title: 'H', value: 'h'},
    {title: 'I', value: 'i'},
    {title: 'J', value: 'j'},
  ];
  const asyncFetch = simulateAsyncFetch(demoAll, 3);
  const useLoadMore = true;
  const useSearch = true;

  // state
  const [open, setOpen] = React.useState(false);
  const [asyncFetchMeta, setAsyncFetchMeta] = React.useState(undefined);
  const [loading, setLoading] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [asyncListValues, setAsyncListValues] = React.useState(undefined);

  // compute
  const listValues = asyncFetch ? 
    (!allowCustomValues ? mergeListValues(asyncListValues, selectedAsyncListValues, true) : asyncListValues) :
    staticListValues;
  const isLoading = open && loading;
  const isInitialLoading = open && listValues === undefined;
  const canLoadMore = !isLoading && !isInitialLoading && listValues && listValues.length > 0 && asyncFetchMeta && asyncFetchMeta.hasMore;
  const options = mapListValues(listValues, listValueToOption);
  const hasValue = selectedValue != null;
  //const selectedListValue = hasValue ? getListValue(selectedValue, listValues) : null;
  //const selectedOption = listValueToOption(selectedListValue);
  
  // fetch
  const fetchListValues = async (filter = null, isLoadMore = false) => {
    // clear last meta
    if (!isLoadMore && asyncFetchMeta) {
      setAsyncFetchMeta(undefined);
    }

    const offset = isLoadMore && asyncListValues ? asyncListValues.length : 0;
    const meta = isLoadMore && asyncFetchMeta;

    const res = await asyncFetch(filter, offset, meta);

    const {values, hasMore, meta: newMeta} = res && res.values ? res : {values: res};
    let assumeHasMore;
    let newValues;
    if (isLoadMore) {
      newValues = mergeListValues(asyncListValues, values, false);
      assumeHasMore = newValues.length > asyncListValues.length;
    } else {
      newValues = values;
    }
    
    // save new meta
    const realNewMeta = hasMore != null || newMeta != null || assumeHasMore != null ? {
      ...(assumeHasMore != null ? {hasMore: assumeHasMore} : {}),
      ...(hasMore != null ? {hasMore} : {}),
      ...(newMeta != null ? newMeta : {}),
    } : undefined;
    if (realNewMeta) {
      setAsyncFetchMeta(realNewMeta);
    }

    return newValues;
  };

  const loadListValues = async (fetchFn) => {
    setLoading(true);
    const list = await fetchFn();
    if (list != null) {
      // tip: null can be used for reject (eg, if user don't want to filter by input)
      setAsyncListValues(list);
    }
    setLoading(false);
  };

  // Initial loading
  React.useEffect(() => {
    let active = true, loading = false;
    
    if (!isInitialLoading)
      return undefined;

    (async () => {
      if (active && !loading) {
        loading = true;
        await loadListValues(() => fetchListValues());
        loading = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [isInitialLoading]);

  // on
  let isSelectedLoadMore;
  const onOpen = () => setOpen(true);
  const onClose = (_e) => {
    if (isSelectedLoadMore) {
      isSelectedLoadMore = false;
    } else {
      setOpen(false);
    }
  }

  const onChange = async (_e, option) => {
    if (option && option.specialValue) {
      isSelectedLoadMore = true;
      await loadListValues(() => fetchListValues(inputValue, true), true);
    } else {
      setValue(option == null ? undefined : option.value, [option]);
    }
  };

  const onInputChange = async (e, newInputValue) => {
    let val = newInputValue;

    if (val === loadMoreTitle) {
      return;
    }

    setInputValue(val);

    if (allowCustomValues) {
      setValue(val, [val]);
    }

    if (useSearch) {
      await loadListValues(() => fetchListValues(val));
    }
  };

  const filterOptions = (options, params) => {
    const filtered = defaultFilterOptions(options, params);
    if (useLoadMore && canLoadMore) {
      filtered.push({
        specialValue: 'LOAD_MORE',
        title: loadMoreTitle,
      });
    }
    return filtered;
  };

  // render
  const renderInput = (params) => {
    return (
      <TextField 
        {...params} 
        InputProps={{
          ...params.InputProps,
          readOnly: readonly,
          endAdornment: (
            <React.Fragment>
              {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
              {params.InputProps.endAdornment}
            </React.Fragment>
          ),
        }}
        disabled={readonly}
        placeholder={!readonly ? placeholder : ""}
        //onChange={onInputChange}
        {...customInputProps}
      />
    );
  };

  const getOptionSelected = (option, valueOrOption) => {
    if (valueOrOption == null)
      return null;
    const selectedValue = valueOrOption.value != undefined ? valueOrOption.value : valueOrOption;
    return option.value === selectedValue;
  };

  const getOptionLabel = (valueOrOption) => {
    if (valueOrOption == null)
      return null;
    const option = valueOrOption.value != undefined ? valueOrOption : 
      listValueToOption(getListValue(valueOrOption, listValues));
    if (!option && valueOrOption.specialValue) {
      // special last 'Load more...' item
      return valueOrOption.title;
    }
    if (!option && allowCustomValues) {
      // there is just string value, it's not item from list
      return valueOrOption;
    }
    if (!option) {
      // weird
      return valueOrOption;
    }
    return option.title;
  };

  return (
    <FormControl>
      <Autocomplete
        fullWidth
        style={{ width: width || defaultSliderWidth }}
        freeSolo={allowCustomValues}
        loading={isInitialLoading}
        open={open}
        onOpen={onOpen}
        onClose={onClose}
        inputValue={inputValue}
        onInputChange={onInputChange}
        label={!readonly ? placeholder : ""}
        onChange={onChange}
        value={hasValue ? selectedValue : null} // should be simple value to prevent re-render!
        getOptionSelected={getOptionSelected}
        disabled={readonly}
        readOnly={readonly}
        options={options}
        getOptionLabel={getOptionLabel}
        renderInput={renderInput}
        filterOptions={filterOptions}
        {...customAutocompleteProps}
      ></Autocomplete>
    </FormControl>
  );
};
import {
  ChatContextType,
  DateInfoType,
  EntityInfoType,
  FilterItemType,
  MsgDataType,
  ParseStateEnum,
  ParseTimeCostType,
  RangeValue,
} from '../../common/type';
import React, { createContext, useEffect, useState } from 'react';
import { chatExecute, chatParse, queryData, deleteQuery, switchEntity } from '../../service';
import { PARSE_ERROR_TIP, PREFIX_CLS, SEARCH_EXCEPTION_TIP } from '../../common/constants';
import { message, Spin } from 'antd';
import IconFont from '../IconFont';
import ParseTip from './ParseTip';
import ExecuteItem from './ExecuteItem';
import classNames from 'classnames';
import Tools from '../Tools';
import { AgentType } from '../../Chat/type';
import dayjs, { Dayjs } from 'dayjs';
import { exportCsvFile } from '../../utils/utils';
import { useMethodRegister } from '../../hooks';

type Props = {
  msg: string;
  conversationId?: number;
  questionId?: number;
  modelId?: number;
  agentId?: number;
  score?: number;
  filter?: any[];
  parseInfos?: ChatContextType[];
  parseTimeCostValue?: ParseTimeCostType;
  msgData?: MsgDataType;
  triggerResize?: boolean;
  isDeveloper?: boolean;
  integrateSystem?: string;
  isSimpleMode?: boolean;
  currentAgent?: AgentType;
  isLastMessage?: boolean;
  onMsgDataLoaded?: (data: MsgDataType, valid: boolean, isRefresh?: boolean) => void;
  onUpdateMessageScroll?: () => void;
  onSendMsg?: (msg: string) => void;
};

export const ChartItemContext = createContext({
  register: (...args: any[]) => {},
  call: (...args: any[]) => {},
});

const ChatItem: React.FC<Props> = ({
  msg,
  conversationId,
  questionId,
  modelId,
  agentId,
  score,
  filter,
  parseInfos,
  parseTimeCostValue,
  msgData,
  triggerResize,
  isDeveloper,
  integrateSystem,
  isSimpleMode,
  currentAgent,
  isLastMessage,
  onMsgDataLoaded,
  onUpdateMessageScroll,
  onSendMsg,
}) => {
  const [parseLoading, setParseLoading] = useState(false);
  const [parseTimeCost, setParseTimeCost] = useState<ParseTimeCostType>();
  const [parseInfo, setParseInfo] = useState<ChatContextType>();
  const [parseInfoOptions, setParseInfoOptions] = useState<ChatContextType[]>([]);
  const [parseTip, setParseTip] = useState('');
  const [executeMode, setExecuteMode] = useState(false);
  const [preParseMode, setPreParseMode] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeTip, setExecuteTip] = useState('');
  const [executeErrorMsg, setExecuteErrorMsg] = useState('');
  const [data, setData] = useState<MsgDataType>();
  const [entitySwitchLoading, setEntitySwitchLoading] = useState(false);
  const [dimensionFilters, setDimensionFilters] = useState<FilterItemType[]>([]);
  const [dateInfo, setDateInfo] = useState<DateInfoType>({} as DateInfoType);
  const [entityInfo, setEntityInfo] = useState<EntityInfoType>({} as EntityInfoType);
  const [dataCache, setDataCache] = useState<Record<number, { tip: string; data?: MsgDataType }>>(
    {}
  );

  const resetState = () => {
    setParseLoading(false);
    setParseTimeCost(undefined);
    setParseInfo(undefined);
    setParseInfoOptions([]);
    setPreParseMode(false);
    setParseTip('');
    setExecuteMode(false);
    setDimensionFilters([]);
    setData(undefined);
    setExecuteErrorMsg('');
    setDateInfo({} as DateInfoType);
    setEntityInfo({} as EntityInfoType);
    setDataCache({});
  };

  const prefixCls = `${PREFIX_CLS}-item`;

  const updateData = (res: Result<MsgDataType>) => {
    let tip: string = '';
    let data: MsgDataType | undefined = undefined;
    const { queryColumns, queryResults, queryState, queryMode, response, chatContext, errorMsg } =
      res.data || {};
    setExecuteErrorMsg(errorMsg);
    if (res.code === 400 || res.code === 401 || res.code === 412) {
      tip = res.msg;
    } else if (res.code !== 200) {
      tip = SEARCH_EXCEPTION_TIP;
    } else if (queryState !== 'SUCCESS') {
      tip = response && typeof response === 'string' ? response : SEARCH_EXCEPTION_TIP;
    } else if (
      (queryColumns && queryColumns.length > 0 && queryResults) ||
      queryMode === 'WEB_PAGE' ||
      queryMode === 'WEB_SERVICE' ||
      queryMode === 'PLAIN_TEXT'
    ) {
      data = res.data;
      tip = '';
    }
    if (chatContext) {
      setDataCache({ ...dataCache, [chatContext!.id!]: { tip, data } });
    }
    if (data) {
      setData(data);
      setExecuteTip('');
      return true;
    }
    setExecuteTip(tip || SEARCH_EXCEPTION_TIP);
    return false;
  };

  const onExecute = async (
    parseInfoValue: ChatContextType,
    parseInfos?: ChatContextType[],
    isSwitchParseInfo?: boolean,
    isRefresh = false
  ) => {
    setExecuteMode(true);
    if (isSwitchParseInfo) {
      setEntitySwitchLoading(true);
    } else {
      setExecuteLoading(true);
    }
    try {
      const res: any = await chatExecute(msg, conversationId!, parseInfoValue, agentId);
      const valid = updateData(res);
      onMsgDataLoaded?.(
        {
          ...res.data,
          parseInfos,
          queryId: parseInfoValue.queryId,
        },
        valid,
        isRefresh
      );
    } catch (e) {
      const tip = SEARCH_EXCEPTION_TIP;
      setExecuteTip(SEARCH_EXCEPTION_TIP);
      setDataCache({ ...dataCache, [parseInfoValue!.id!]: { tip } });
    }
    if (isSwitchParseInfo) {
      setEntitySwitchLoading(false);
    } else {
      setExecuteLoading(false);
    }
  };

  const updateDimensionFitlers = (filters: FilterItemType[]) => {
    setDimensionFilters(
      filters.sort((a, b) => {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }
        return 0;
      })
    );
  };

  const sendMsg = async () => {
    setParseLoading(true);
    const parseData: any = await chatParse({
      queryText: msg,
      chatId: conversationId,
      modelId,
      agentId,
      filters: filter,
    });
    setParseLoading(false);
    const { code, data } = parseData || {};
    const { state, selectedParses, candidateParses, queryId, parseTimeCost, errorMsg } = data || {};
    const parses = selectedParses?.concat(candidateParses || []) || [];
    if (
      code !== 200 ||
      state === ParseStateEnum.FAILED ||
      !parses.length ||
      (!parses[0]?.properties?.type && !parses[0]?.queryMode)
    ) {
      setParseTip(state === ParseStateEnum.FAILED && errorMsg ? errorMsg : PARSE_ERROR_TIP);

      setParseInfo({ queryId } as any);
      return;
    }
    onUpdateMessageScroll?.();
    const parseInfos = parses.slice(0, 5).map((item: any) => ({
      ...item,
      queryId,
    }));
    if (parseInfos.length > 1) {
      setPreParseMode(true);
    }
    setParseInfoOptions(parseInfos || []);
    const parseInfoValue = parseInfos[0];
    if (!(currentAgent?.enableFeedback === 1 && parseInfos.length > 1)) {
      setParseInfo(parseInfoValue);
    }
    setParseTimeCost(parseTimeCost);
    setEntityInfo(parseInfoValue.entityInfo || {});
    updateDimensionFitlers(parseInfoValue?.dimensionFilters || []);
    setDateInfo(parseInfoValue?.dateInfo);
    if (parseInfos.length === 1) {
      onExecute(parseInfoValue, parseInfos);
    }
  };

  const initChatItem = (msg, msgData) => {
    if (msgData) {
      const parseInfoOptionsValue =
        parseInfos && parseInfos.length > 0
          ? parseInfos.map(item => ({ ...item, queryId: msgData.queryId }))
          : [{ ...msgData.chatContext, queryId: msgData.queryId }];
      const parseInfoValue = parseInfoOptionsValue[0];
      setParseInfoOptions(parseInfoOptionsValue);
      setParseInfo(parseInfoValue);
      setParseTimeCost(parseTimeCostValue);
      updateDimensionFitlers(parseInfoValue.dimensionFilters || []);
      setDateInfo(parseInfoValue.dateInfo);
      setExecuteMode(true);
      updateData({ code: 200, data: msgData, msg: 'success' });
    } else if (msg) {
      sendMsg();
    }
  };

  useEffect(() => {
    if (data !== undefined || executeTip !== '' || parseLoading) {
      return;
    }
    initChatItem(msg, msgData);
  }, [msg, msgData]);

  const onSwitchEntity = async (entityId: string) => {
    setEntitySwitchLoading(true);
    const res = await switchEntity(entityId, data?.chatContext?.modelId, conversationId || 0);
    setEntitySwitchLoading(false);
    setData(res.data);
    const { chatContext, entityInfo } = res.data || {};
    const chatContextValue = { ...(chatContext || {}), queryId: parseInfo?.queryId };
    setParseInfo(chatContextValue);
    setEntityInfo(entityInfo);
    updateDimensionFitlers(chatContextValue?.dimensionFilters || []);
    setDateInfo(chatContextValue?.dateInfo);
    setDataCache({ ...dataCache, [chatContextValue.id!]: { tip: '', data: res.data } });
  };

  const onFiltersChange = (dimensionFilters: FilterItemType[]) => {
    setDimensionFilters(dimensionFilters);
  };

  const onDateInfoChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const [start, end] = dates;
      setDateInfo({
        ...(dateInfo || {}),
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD'),
        dateMode: 'BETWEEN',
        unit: 0,
      });
    }
  };

  const handlePresetClick = (range: RangeValue) => {
    setDateInfo({
      ...(dateInfo || {}),
      startDate: dayjs(range[0]).format('YYYY-MM-DD'),
      endDate: dayjs(range[1]).format('YYYY-MM-DD'),
      dateMode: 'BETWEEN',
      unit: 0,
    });
  };

  const onRefresh = async (parseInfoValue?: ChatContextType) => {
    setEntitySwitchLoading(true);
    const { dimensions, metrics, id, queryId } = parseInfoValue || parseInfo || {};
    const chatContextValue = {
      dimensions,
      metrics,
      dateInfo,
      dimensionFilters,
      parseId: id,
      queryId,
    };
    const res: any = await queryData(chatContextValue);
    setEntitySwitchLoading(false);
    if (res.code === 200) {
      const resChatContext = res.data?.chatContext;
      const contextValue = { ...(resChatContext || chatContextValue), queryId };
      const dataValue = {
        ...res.data,
        chatContext: contextValue,
        parseInfos: parseInfoOptions,
        queryId,
      };
      onMsgDataLoaded?.(dataValue, true, true);
      setData(dataValue);
      setParseInfo(contextValue);
      setDataCache({ ...dataCache, [id!]: { tip: '', data: dataValue } });
    }
  };

  const deleteQueryInfo = async (queryId: number) => {
    const { code }: any = await deleteQuery(queryId);
    if (code === 200) {
      resetState();
      initChatItem(msg, undefined);
    }
  };

  const onExportData = () => {
    const { queryColumns, queryResults } = data || {};
    if (!!queryResults) {
      const exportData = queryResults.map(item => {
        return Object.keys(item).reduce((result, key) => {
          const columnName = queryColumns?.find(column => column.nameEn === key)?.name || key;
          result[columnName] = item[key];
          return result;
        }, {});
      });
      exportCsvFile(exportData);
    }
  };

  const contentClass = classNames(`${prefixCls}-content`);

  const { register, call } = useMethodRegister(() => message.error('该条消息暂不支持该操作'));

  return (
    <ChartItemContext.Provider value={{ register, call }}>
      <div className={prefixCls}>
        <IconFont type="icon-zhinengsuanfa" className={`${prefixCls}-avatar`}/>
        <div>
          <div className={`${prefixCls}-time`}>
            {parseTimeCost?.parseStartTime
              ? dayjs(parseTimeCost.parseStartTime).format('M月D日 HH:mm')
              : ''}
          </div>
          <div className={contentClass}>
            <>
              {!preParseMode && (
                <ParseTip
                  parseLoading={parseLoading}
                  parseInfoOptions={parseInfoOptions}
                  parseTip={parseTip}
                  currentParseInfo={parseInfo}
                  agentId={agentId}
                  dimensionFilters={dimensionFilters}
                  dateInfo={dateInfo}
                  entityInfo={entityInfo}
                  integrateSystem={integrateSystem}
                  parseTimeCost={parseTimeCost?.parseTime}
                  isDeveloper={isDeveloper}
                  onSwitchEntity={onSwitchEntity}
                  onFiltersChange={onFiltersChange}
                  onDateInfoChange={onDateInfoChange}
                  onRefresh={() => {
                    onRefresh();
                  }}
                  handlePresetClick={handlePresetClick}
                />
              )}
            </>

            {executeMode && (
              <Spin spinning={entitySwitchLoading}>
                <div style={{ minHeight: 50 }}>
                  <ExecuteItem
                    queryId={parseInfo?.queryId}
                    question={msg}
                    queryMode={parseInfo?.queryMode}
                    executeLoading={executeLoading}
                    executeTip={executeTip}
                    executeErrorMsg={executeErrorMsg}
                    data={data}
                    triggerResize={triggerResize}
                    isDeveloper={isDeveloper}
                  />
                </div>
              </Spin>
            )}
          </div>
          {(parseTip !== '' || (executeMode && !executeLoading)) &&
            parseInfo?.queryMode !== 'PLAIN_TEXT' && (
              <Tools
                isLastMessage={isLastMessage}
                queryId={parseInfo?.queryId || 0}
                scoreValue={score}
                onExportData={() => {
                  onExportData();
                }}
                onReExecute={queryId => {
                  deleteQueryInfo(queryId);
                }}
              />
            )}
        </div>
      </div>
    </ChartItemContext.Provider>
  );
};

export default ChatItem;

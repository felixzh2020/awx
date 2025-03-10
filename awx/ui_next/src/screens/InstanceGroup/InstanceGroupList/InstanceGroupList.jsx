import React, { useEffect, useCallback } from 'react';
import { useLocation, useRouteMatch, Link } from 'react-router-dom';

import { t, Plural } from '@lingui/macro';
import { Card, PageSection, DropdownItem } from '@patternfly/react-core';

import { InstanceGroupsAPI } from '../../../api';
import { getQSConfig, parseQueryString } from '../../../util/qs';
import useRequest, { useDeleteItems } from '../../../util/useRequest';
import useSelected from '../../../util/useSelected';
import PaginatedTable, {
  HeaderRow,
  HeaderCell,
} from '../../../components/PaginatedTable';
import { ToolbarDeleteButton } from '../../../components/PaginatedDataList';
import ErrorDetail from '../../../components/ErrorDetail';
import AlertModal from '../../../components/AlertModal';
import DatalistToolbar from '../../../components/DataListToolbar';
import AddDropDownButton from '../../../components/AddDropDownButton';
import { relatedResourceDeleteRequests } from '../../../util/getRelatedResourceDeleteDetails';
import InstanceGroupListItem from './InstanceGroupListItem';

const QS_CONFIG = getQSConfig('instance-group', {
  page: 1,
  page_size: 20,
});

function modifyInstanceGroups(items = []) {
  return items.map(item => {
    const clonedItem = {
      ...item,
      summary_fields: {
        ...item.summary_fields,
        user_capabilities: {
          ...item.summary_fields.user_capabilities,
        },
      },
    };
    if (clonedItem.name === 'tower') {
      clonedItem.summary_fields.user_capabilities.delete = false;
    }
    return clonedItem;
  });
}

function InstanceGroupList() {
  const location = useLocation();
  const match = useRouteMatch();

  const {
    error: contentError,
    isLoading,
    request: fetchInstanceGroups,
    result: {
      instanceGroups,
      instanceGroupsCount,
      actions,
      relatedSearchableKeys,
      searchableKeys,
    },
  } = useRequest(
    useCallback(async () => {
      const params = parseQueryString(QS_CONFIG, location.search);

      const [response, responseActions] = await Promise.all([
        InstanceGroupsAPI.read(params),
        InstanceGroupsAPI.readOptions(),
      ]);

      return {
        instanceGroups: response.data.results,
        instanceGroupsCount: response.data.count,
        actions: responseActions.data.actions,
        relatedSearchableKeys: (
          responseActions?.data?.related_search_fields || []
        ).map(val => val.slice(0, -8)),
        searchableKeys: Object.keys(
          responseActions.data.actions?.GET || {}
        ).filter(key => responseActions.data.actions?.GET[key].filterable),
      };
    }, [location]),
    {
      instanceGroups: [],
      instanceGroupsCount: 0,
      actions: {},
      relatedSearchableKeys: [],
      searchableKeys: [],
    }
  );

  useEffect(() => {
    fetchInstanceGroups();
  }, [fetchInstanceGroups]);

  const { selected, isAllSelected, handleSelect, setSelected } = useSelected(
    instanceGroups
  );

  const modifiedSelected = modifyInstanceGroups(selected);

  const {
    isLoading: deleteLoading,
    deletionError,
    deleteItems: deleteInstanceGroups,
    clearDeletionError,
  } = useDeleteItems(
    useCallback(() => {
      return Promise.all(
        selected.map(({ id }) => InstanceGroupsAPI.destroy(id))
      );
    }, [selected]),
    {
      qsConfig: QS_CONFIG,
      allItemsSelected: isAllSelected,
      fetchItems: fetchInstanceGroups,
    }
  );

  const handleDelete = async () => {
    await deleteInstanceGroups();
    setSelected([]);
  };

  const canAdd = actions && actions.POST;

  function cannotDelete(item) {
    return !item.summary_fields.user_capabilities.delete;
  }

  const pluralizedItemName = t`Instance Groups`;

  let errorMessageDelete = '';

  if (modifiedSelected.some(item => item.name === 'tower')) {
    const itemsUnableToDelete = modifiedSelected
      .filter(cannotDelete)
      .filter(item => item.name !== 'tower')
      .map(item => item.name)
      .join(', ');

    if (itemsUnableToDelete) {
      if (modifiedSelected.some(cannotDelete)) {
        errorMessageDelete = t`You do not have permission to delete ${pluralizedItemName}: ${itemsUnableToDelete}. `;
      }
    }

    if (errorMessageDelete.length > 0) {
      errorMessageDelete = errorMessageDelete.concat('\n');
    }
    errorMessageDelete = errorMessageDelete.concat(
      t`The tower instance group cannot be deleted.`
    );
  }

  const addContainerGroup = t`Add container group`;
  const addInstanceGroup = t`Add instance group`;

  const addButton = (
    <AddDropDownButton
      ouiaId="add-instance-group-button"
      key="add"
      dropdownItems={[
        <DropdownItem
          ouiaId="add-container-group-item"
          to="/instance_groups/container_group/add"
          component={Link}
          key={addContainerGroup}
          aria-label={addContainerGroup}
        >
          {addContainerGroup}
        </DropdownItem>,
        <DropdownItem
          ouiaId="add-instance-group-item"
          to="/instance_groups/add"
          component={Link}
          key={addInstanceGroup}
          aria-label={addInstanceGroup}
        >
          {addInstanceGroup}
        </DropdownItem>,
      ]}
    />
  );

  const getDetailUrl = item => {
    return item.is_container_group
      ? `${match.url}/container_group/${item.id}/details`
      : `${match.url}/${item.id}/details`;
  };
  const deleteDetailsRequests = relatedResourceDeleteRequests.instanceGroup(
    selected[0]
  );
  return (
    <>
      <PageSection>
        <Card>
          <PaginatedTable
            contentError={contentError}
            hasContentLoading={isLoading || deleteLoading}
            items={instanceGroups}
            itemCount={instanceGroupsCount}
            pluralizedItemName={pluralizedItemName}
            qsConfig={QS_CONFIG}
            onRowClick={handleSelect}
            toolbarSearchableKeys={searchableKeys}
            toolbarRelatedSearchableKeys={relatedSearchableKeys}
            renderToolbar={props => (
              <DatalistToolbar
                {...props}
                showSelectAll
                isAllSelected={isAllSelected}
                onSelectAll={isSelected =>
                  setSelected(isSelected ? [...instanceGroups] : [])
                }
                qsConfig={QS_CONFIG}
                additionalControls={[
                  ...(canAdd ? [addButton] : []),
                  <ToolbarDeleteButton
                    key="delete"
                    onDelete={handleDelete}
                    itemsToDelete={modifiedSelected}
                    pluralizedItemName={t`Instance Groups`}
                    errorMessage={errorMessageDelete}
                    deleteDetailsRequests={deleteDetailsRequests}
                    deleteMessage={
                      <Plural
                        value={selected.length}
                        one="This instance group is currently being by other resources. Are you sure you want to delete it?"
                        other="Deleting these instance groups could impact other resources that rely on them. Are you sure you want to delete anyway?"
                      />
                    }
                  />,
                ]}
              />
            )}
            headerRow={
              <HeaderRow qsConfig={QS_CONFIG}>
                <HeaderCell sortKey="name">{t`Name`}</HeaderCell>
                <HeaderCell>{t`Type`}</HeaderCell>
                <HeaderCell>{t`Running Jobs`}</HeaderCell>
                <HeaderCell>{t`Total Jobs`}</HeaderCell>
                <HeaderCell>{t`Instances`}</HeaderCell>
                <HeaderCell>{t`Capacity`}</HeaderCell>
                <HeaderCell>{t`Actions`}</HeaderCell>
              </HeaderRow>
            }
            renderRow={(instanceGroup, index) => (
              <InstanceGroupListItem
                key={instanceGroup.id}
                value={instanceGroup.name}
                instanceGroup={instanceGroup}
                detailUrl={getDetailUrl(instanceGroup)}
                onSelect={() => handleSelect(instanceGroup)}
                isSelected={selected.some(row => row.id === instanceGroup.id)}
                rowIndex={index}
              />
            )}
            emptyStateControls={canAdd && addButton}
          />
        </Card>
      </PageSection>
      <AlertModal
        aria-label={t`Deletion error`}
        isOpen={deletionError}
        onClose={clearDeletionError}
        title={t`Error`}
        variant="error"
      >
        {t`Failed to delete one or more instance groups.`}
        <ErrorDetail error={deletionError} />
      </AlertModal>
    </>
  );
}

export default InstanceGroupList;
